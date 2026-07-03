<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Sale;
use App\Models\SaleItem;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $roleId = (int) session('role_id');
        $canViewAllBranches = in_array($roleId, [2, 3], true);
        $selectedBranchId = $this->resolveSelectedBranchId($roleId, $request);
        $statsPeriod = $this->resolveStatsPeriod($request);
        $statsDate = $this->resolveStatsDate($request, $statsPeriod);
        $paymentMethod = $this->resolvePaymentMethod($request);

        $salesQuery = $this->scopedSalesQuery($roleId, $selectedBranchId);
        $statsQuery = $this->applyStatsDateFilter(clone $salesQuery, $statsPeriod, $statsDate);
        $statsQuery = $this->applyPaymentMethodFilter($statsQuery, $paymentMethod);

        $totalRevenue = $statsQuery->sum('net_amount');
        $totalTransactions = $statsQuery->count();

        $branchName = $this->resolveBranchName($roleId, $selectedBranchId);

        return Inertia::render('Dashboard', [
            'stats' => [
                'totalRevenue' => (float) $totalRevenue,
                'totalTransactions' => $totalTransactions,
            ],
            'topMedicines' => $this->topSellingMedicines($roleId, $selectedBranchId),
            'branchPerformance' => $canViewAllBranches ? $this->branchPerformance() : [],
            'charts' => [
                'revenueTrend' => $this->revenueTrend($roleId, $selectedBranchId),
                'productBreakdown' => $this->productBreakdown($roleId, $selectedBranchId),
                'branchComparison' => $canViewAllBranches
                    ? $this->branchComparisonChartData()
                    : null,
            ],
            'branches' => $canViewAllBranches
                ? Branch::query()->orderBy('branch_name')->get(['id', 'branch_name'])
                : [],
            'filters' => [
                'branch_id' => $selectedBranchId,
                'stats_period' => $statsPeriod,
                'stats_date' => $statsDate,
                'payment_method' => $paymentMethod,
            ],
            'statsPeriodLabel' => $this->statsPeriodLabel($statsPeriod, $statsDate),
            'paymentMethodLabel' => $this->paymentMethodLabel($paymentMethod),
            'canViewAllBranches' => $canViewAllBranches,
            'branchName' => $branchName,
            'dashboardRoute' => $this->dashboardRouteName($roleId),
        ]);
    }

    private function resolveSelectedBranchId(int $roleId, Request $request): string
    {
        if ($roleId === 1) {
            return (string) $this->branchIdOrFail();
        }

        $branchId = $request->input('branch_id', 'all');

        if ($branchId === 'all' || $branchId === '' || $branchId === null) {
            return 'all';
        }

        return (string) (int) $branchId;
    }

    private function scopedSalesQuery(int $roleId, string $selectedBranchId)
    {
        $query = Sale::query();

        if ($roleId === 1) {
            $query->where('branch_id', $this->branchIdOrFail());
        } elseif ($selectedBranchId !== 'all') {
            $query->where('branch_id', (int) $selectedBranchId);
        }

        return $query;
    }

    private function resolveStatsPeriod(Request $request): string
    {
        $period = $request->input('stats_period', 'all');

        return in_array($period, ['all', 'daily', 'weekly', 'monthly'], true) ? $period : 'all';
    }

    private function resolveStatsDate(Request $request, string $statsPeriod): ?string
    {
        if ($statsPeriod === 'all') {
            return null;
        }

        $statsDate = $request->input('stats_date');

        if ($statsPeriod === 'monthly') {
            if (is_string($statsDate) && preg_match('/^\d{4}-\d{2}$/', $statsDate)) {
                return $statsDate;
            }

            return now()->format('Y-m');
        }

        if (is_string($statsDate) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $statsDate)) {
            return $statsDate;
        }

        return now()->toDateString();
    }

    private function applyStatsDateFilter($query, string $statsPeriod, ?string $statsDate)
    {
        if ($statsPeriod === 'all' || $statsDate === null) {
            return $query;
        }

        [$start, $end] = match ($statsPeriod) {
            'daily' => [
                Carbon::parse($statsDate)->startOfDay(),
                Carbon::parse($statsDate)->endOfDay(),
            ],
            'weekly' => [
                Carbon::parse($statsDate)->startOfWeek(),
                Carbon::parse($statsDate)->endOfWeek(),
            ],
            'monthly' => [
                Carbon::createFromFormat('Y-m', $statsDate)->startOfMonth(),
                Carbon::createFromFormat('Y-m', $statsDate)->endOfMonth(),
            ],
            default => [null, null],
        };

        if ($start === null || $end === null) {
            return $query;
        }

        return $query->whereBetween('created_at', [$start, $end]);
    }

    private function resolvePaymentMethod(Request $request): string
    {
        $paymentMethod = $request->input('payment_method', 'all');

        return in_array($paymentMethod, ['all', 'cash', 'gcash'], true) ? $paymentMethod : 'all';
    }

    private function applyPaymentMethodFilter($query, string $paymentMethod)
    {
        if ($paymentMethod === 'all') {
            return $query;
        }

        return $query->where('payment_method', $paymentMethod);
    }

    private function paymentMethodLabel(string $paymentMethod): ?string
    {
        return match ($paymentMethod) {
            'cash' => 'Cash',
            'gcash' => 'GCash',
            default => null,
        };
    }

    private function statsPeriodLabel(string $statsPeriod, ?string $statsDate): ?string
    {
        return match ($statsPeriod) {
            'daily' => Carbon::parse($statsDate)->format('F j, Y'),
            'weekly' => sprintf(
                '%s – %s',
                Carbon::parse($statsDate)->startOfWeek()->format('M j'),
                Carbon::parse($statsDate)->endOfWeek()->format('M j, Y')
            ),
            'monthly' => Carbon::createFromFormat('Y-m', $statsDate)->format('F Y'),
            default => null,
        };
    }

    private function topSellingMedicines(int $roleId, string $selectedBranchId): array
    {
        return SaleItem::query()
            ->join('tbl_sales', 'tbl_sales_items.sale_id', '=', 'tbl_sales.id')
            ->join('tbl_products', 'tbl_sales_items.product_id', '=', 'tbl_products.id')
            ->when($roleId === 1, fn ($query) => $query->where('tbl_sales.branch_id', $this->branchIdOrFail()))
            ->when(
                $roleId !== 1 && $selectedBranchId !== 'all',
                fn ($query) => $query->where('tbl_sales.branch_id', (int) $selectedBranchId)
            )
            ->select([
                'tbl_products.id',
                'tbl_products.med_name',
                'tbl_products.dose',
                'tbl_products.form',
                'tbl_products.brand_name',
                DB::raw('SUM(tbl_sales_items.quantity_sold) as total_quantity'),
                DB::raw('SUM(tbl_sales_items.total_price) as total_revenue'),
            ])
            ->groupBy(
                'tbl_products.id',
                'tbl_products.med_name',
                'tbl_products.dose',
                'tbl_products.form',
                'tbl_products.brand_name'
            )
            ->orderByDesc('total_quantity')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'name' => trim("{$row->med_name} {$row->dose} {$row->form}"),
                'brand_name' => $row->brand_name,
                'total_quantity' => (int) $row->total_quantity,
                'total_revenue' => (float) $row->total_revenue,
            ])
            ->values()
            ->all();
    }

    private function revenueTrend(int $roleId, string $selectedBranchId): array
    {
        $months = 6;
        $startDate = now()->subMonths($months - 1)->startOfMonth();

        $rows = $this->scopedSalesQuery($roleId, $selectedBranchId)
            ->where('created_at', '>=', $startDate)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as period, SUM(net_amount) as revenue")
            ->groupBy('period')
            ->orderBy('period')
            ->pluck('revenue', 'period');

        $labels = [];
        $values = [];

        for ($i = 0; $i < $months; $i++) {
            $month = $startDate->copy()->addMonths($i);
            $key = $month->format('Y-m');
            $labels[] = $month->format('M Y');
            $values[] = (float) ($rows[$key] ?? 0);
        }

        return [
            'labels' => $labels,
            'values' => $values,
            'period' => 'monthly',
        ];
    }

    private function productBreakdown(int $roleId, string $selectedBranchId): array
    {
        $rows = SaleItem::query()
            ->join('tbl_sales', 'tbl_sales_items.sale_id', '=', 'tbl_sales.id')
            ->join('tbl_products', 'tbl_sales_items.product_id', '=', 'tbl_products.id')
            ->when($roleId === 1, fn ($query) => $query->where('tbl_sales.branch_id', $this->branchIdOrFail()))
            ->when(
                $roleId !== 1 && $selectedBranchId !== 'all',
                fn ($query) => $query->where('tbl_sales.branch_id', (int) $selectedBranchId)
            )
            ->select([
                DB::raw("COALESCE(NULLIF(TRIM(tbl_products.form), ''), 'Uncategorized') as category"),
                DB::raw('SUM(tbl_sales_items.total_price) as revenue'),
            ])
            ->groupBy('category')
            ->orderByDesc('revenue')
            ->get();

        return [
            'labels' => $rows->pluck('category')->all(),
            'values' => $rows->pluck('revenue')->map(fn ($value) => (float) $value)->all(),
        ];
    }

    private function branchComparisonChartData(): array
    {
        $branches = $this->branchPerformance();

        return [
            'labels' => array_column($branches, 'branch_name'),
            'values' => array_column($branches, 'total_revenue'),
        ];
    }

    private function branchPerformance(): array
    {
        return Sale::query()
            ->join('branches', 'tbl_sales.branch_id', '=', 'branches.id')
            ->select([
                'branches.id',
                'branches.branch_name',
                DB::raw('SUM(tbl_sales.net_amount) as total_revenue'),
                DB::raw('COUNT(tbl_sales.id) as transaction_count'),
            ])
            ->groupBy('branches.id', 'branches.branch_name')
            ->orderBy('branches.branch_name')
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'branch_name' => $row->branch_name,
                'total_revenue' => (float) $row->total_revenue,
                'transaction_count' => (int) $row->transaction_count,
            ])
            ->values()
            ->all();
    }

    private function resolveBranchName(int $roleId, string $selectedBranchId): ?string
    {
        if ($roleId === 1) {
            return Branch::query()
                ->whereKey($this->branchIdOrFail())
                ->value('branch_name');
        }

        if ($selectedBranchId === 'all') {
            return null;
        }

        return Branch::query()
            ->whereKey((int) $selectedBranchId)
            ->value('branch_name');
    }

    private function dashboardRouteName(int $roleId): string
    {
        return match ($roleId) {
            2 => 'admin-dashboard',
            3 => 'superadmin-dashboard',
            default => 'dashboard',
        };
    }

    private function branchId(): ?int
    {
        $branchId = session('branch_id');

        return $branchId ? (int) $branchId : null;
    }

    private function branchIdOrFail(): int
    {
        $branchId = $this->branchId();

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        return $branchId;
    }
}
