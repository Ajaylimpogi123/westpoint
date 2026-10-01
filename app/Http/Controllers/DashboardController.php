<?php

namespace App\Http\Controllers;

use App\Enums\PaymentMethod;
use App\Enums\UnitType;
use App\Models\Branch;
use App\Models\Sale;
use App\Models\SaleItem;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Sales dashboard for every role.
 *
 * Revenue follows the Reports module: a sale's net_amount never changes after
 * checkout and voids/returns are tracked in refunded_amount, so revenue is
 * net_amount - refunded_amount. Fully Voided sales are additionally excluded
 * from revenue and transaction counts (their net is ~0 anyway, but line-level
 * refund rounding can leave centavo residue) and surfaced separately.
 *
 * Item-level figures use the same net basis per line
 * (total_price - discount_amount - refunded_amount) and quantities are in
 * pieces so Box and Piece lines can be ranked together.
 */
class DashboardController extends Controller
{
    private const MONTHS_IN_TREND = 6;

    public function index(Request $request): Response
    {
        $roleId = (int) session('role_id');
        $canViewAllBranches = in_array($roleId, [2, 3], true);

        $branches = $canViewAllBranches
            ? Branch::query()->orderBy('branch_name')->get(['id', 'branch_name'])
            : collect();

        $branchId = $this->resolveBranchId($roleId, $request, $branches);
        $statsPeriod = $this->resolveStatsPeriod($request);
        $statsDate = $this->resolveStatsDate($request, $statsPeriod);
        $range = $this->statsRange($statsPeriod, $statsDate);
        $paymentMethod = PaymentMethod::fromFilterValue($request->input('payment_method'));

        $branchPerformance = $canViewAllBranches
            ? $this->branchPerformance($branches, $range, $paymentMethod)
            : [];

        return Inertia::render('Dashboard', [
            'stats' => $this->stats($branchId, $range, $paymentMethod),
            'topMedicines' => $this->topSellingMedicines($branchId, $range, $paymentMethod),
            'branchPerformance' => $branchPerformance,
            'charts' => [
                'revenueTrend' => $this->revenueTrend($branchId, $paymentMethod),
                'productBreakdown' => $this->productBreakdown($branchId, $range, $paymentMethod),
                'branchComparison' => $canViewAllBranches
                    ? [
                        'labels' => array_column($branchPerformance, 'branch_name'),
                        'values' => array_column($branchPerformance, 'total_revenue'),
                    ]
                    : null,
            ],
            'branches' => $branches,
            'paymentMethods' => PaymentMethod::filterOptions(),
            'filters' => [
                'branch_id' => $branchId === null ? 'all' : (string) $branchId,
                'stats_period' => $statsPeriod,
                'stats_date' => $statsDate,
                'payment_method' => $paymentMethod?->filterValue() ?? 'all',
            ],
            'statsPeriodLabel' => $this->statsPeriodLabel($statsPeriod, $range),
            'paymentMethodLabel' => $paymentMethod?->label(),
            'canViewAllBranches' => $canViewAllBranches,
            'branchName' => $this->resolveBranchName($roleId, $branchId, $branches),
            'dashboardRoute' => $this->dashboardRouteName($roleId),
        ]);
    }

    /* ───────────────────────── Filter resolution ───────────────────────── */

    /**
     * Staff are pinned to their session branch. Admin/Superadmin may pick any
     * listed (non-deleted) branch; anything else means "all branches" (null).
     */
    private function resolveBranchId(int $roleId, Request $request, Collection $branches): ?int
    {
        if ($roleId === 1) {
            return $this->branchIdOrFail();
        }

        $requested = $request->input('branch_id');

        if (! is_scalar($requested) || ! ctype_digit((string) $requested)) {
            return null;
        }

        $branchId = (int) $requested;

        return $branches->contains('id', $branchId) ? $branchId : null;
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

        $format = $statsPeriod === 'monthly' ? 'Y-m' : 'Y-m-d';
        $input = $request->input('stats_date');

        return $this->parseStrictDate($input, $format) !== null
            ? $input
            : now()->format($format);
    }

    /**
     * Parses a date only if it is a real calendar date in exactly this format.
     * The "!" prefix resets unspecified fields, so "2026-02" is Feb 1st rather
     * than inheriting today's day-of-month (which overflowed Feb into March
     * on the 29th-31st).
     */
    private function parseStrictDate(mixed $value, string $format): ?Carbon
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            $date = Carbon::createFromFormat('!'.$format, $value);
        } catch (\Throwable) {
            return null;
        }

        return $date && $date->format($format) === $value ? $date : null;
    }

    /**
     * @return array{0: Carbon, 1: Carbon}|null
     */
    private function statsRange(string $statsPeriod, ?string $statsDate): ?array
    {
        if ($statsPeriod === 'all' || $statsDate === null) {
            return null;
        }

        if ($statsPeriod === 'monthly') {
            $month = $this->parseStrictDate($statsDate, 'Y-m');

            return [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()];
        }

        $day = $this->parseStrictDate($statsDate, 'Y-m-d');

        return match ($statsPeriod) {
            'daily' => [$day->copy()->startOfDay(), $day->copy()->endOfDay()],
            'weekly' => [
                $day->copy()->startOfWeek(Carbon::MONDAY)->startOfDay(),
                $day->copy()->endOfWeek(Carbon::SUNDAY)->endOfDay(),
            ],
        };
    }

    private function statsPeriodLabel(string $statsPeriod, ?array $range): ?string
    {
        if ($range === null) {
            return null;
        }

        [$start, $end] = $range;

        return match ($statsPeriod) {
            'daily' => $start->format('d/m/Y'),
            'weekly' => sprintf('%s – %s', $start->format('d/m/Y'), $end->format('d/m/Y')),
            'monthly' => $start->format('m/Y'),
            default => null,
        };
    }

    /**
     * Applies branch / date range / payment filters to any query that has
     * tbl_sales in scope (directly or joined).
     */
    private function applySalesFilters(
        Builder $query,
        ?int $branchId,
        ?array $range,
        ?PaymentMethod $paymentMethod
    ): Builder {
        return $query
            ->when($branchId !== null, fn (Builder $q) => $q->where('tbl_sales.branch_id', $branchId))
            ->when($range !== null, fn (Builder $q) => $q->whereBetween('tbl_sales.created_at', $range))
            ->when($paymentMethod !== null, fn (Builder $q) => $q->whereIn(
                'tbl_sales.payment_method',
                $paymentMethod->storedValues()
            ));
    }

    /* ───────────────────────────── Aggregates ───────────────────────────── */

    /**
     * @return array{totalRevenue: float, totalTransactions: int, totalRefunded: float, voidedTransactions: int}
     */
    private function stats(?int $branchId, ?array $range, ?PaymentMethod $paymentMethod): array
    {
        $voided = Sale::STATUS_VOIDED;

        $row = $this->applySalesFilters(Sale::query(), $branchId, $range, $paymentMethod)
            ->toBase()
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN tbl_sales.status <> ? THEN tbl_sales.net_amount - tbl_sales.refunded_amount ELSE 0 END), 0) as total_revenue,
                 COALESCE(SUM(CASE WHEN tbl_sales.status <> ? THEN 1 ELSE 0 END), 0) as total_transactions,
                 COALESCE(SUM(tbl_sales.refunded_amount), 0) as total_refunded,
                 COALESCE(SUM(CASE WHEN tbl_sales.status = ? THEN 1 ELSE 0 END), 0) as voided_transactions',
                [$voided, $voided, $voided]
            )
            ->first();

        return [
            'totalRevenue' => round((float) $row->total_revenue, 2),
            'totalTransactions' => (int) $row->total_transactions,
            'totalRefunded' => round((float) $row->total_refunded, 2),
            'voidedTransactions' => (int) $row->voided_transactions,
        ];
    }

    /**
     * Sale lines of non-voided sales within the filters, joined to products.
     */
    private function saleLinesQuery(?int $branchId, ?array $range, ?PaymentMethod $paymentMethod): Builder
    {
        $query = SaleItem::query()
            ->join('tbl_sales', 'tbl_sales_items.sale_id', '=', 'tbl_sales.id')
            ->join('tbl_products', 'tbl_sales_items.product_id', '=', 'tbl_products.id')
            ->where('tbl_sales.status', '<>', Sale::STATUS_VOIDED);

        return $this->applySalesFilters($query, $branchId, $range, $paymentMethod);
    }

    private function netLineRevenueSql(): string
    {
        return 'tbl_sales_items.total_price - tbl_sales_items.discount_amount - tbl_sales_items.refunded_amount';
    }

    private function topSellingMedicines(?int $branchId, ?array $range, ?PaymentMethod $paymentMethod): array
    {
        // Pieces kept = (sold - returned) x (pack_size for Box lines, 1 for
        // Piece lines). Cast to SIGNED so a bad row can't trip MySQL's
        // unsigned-subtraction overflow error.
        $piecesSql = 'SUM((CAST(tbl_sales_items.quantity_sold AS SIGNED) - CAST(tbl_sales_items.returned_quantity AS SIGNED))'
            .' * CASE WHEN tbl_sales_items.unit_type = ? THEN GREATEST(COALESCE(tbl_products.pack_size, 1), 1) ELSE 1 END)';

        return $this->saleLinesQuery($branchId, $range, $paymentMethod)
            ->toBase()
            ->select([
                'tbl_products.id',
                'tbl_products.med_name',
                'tbl_products.dose',
                'tbl_products.form',
                'tbl_products.brand_name',
                'tbl_products.pack_size',
            ])
            ->selectRaw("{$piecesSql} as total_quantity", [UnitType::Box->value])
            ->selectRaw('SUM('.$this->netLineRevenueSql().') as total_revenue')
            ->groupBy(
                'tbl_products.id',
                'tbl_products.med_name',
                'tbl_products.dose',
                'tbl_products.form',
                'tbl_products.brand_name',
                'tbl_products.pack_size'
            )
            ->havingRaw("{$piecesSql} > 0", [UnitType::Box->value])
            ->orderByDesc('total_quantity')
            ->orderByDesc('total_revenue')
            ->orderBy('tbl_products.id')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'name' => trim(preg_replace('/\s+/', ' ', "{$row->med_name} {$row->dose} {$row->form}")),
                'brand_name' => $row->brand_name,
                'pack_size' => max((int) $row->pack_size, 1),
                'total_quantity' => (int) $row->total_quantity,
                'total_revenue' => round((float) $row->total_revenue, 2),
            ])
            ->values()
            ->all();
    }

    private function revenueTrend(?int $branchId, ?PaymentMethod $paymentMethod): array
    {
        $startDate = now()->subMonthsNoOverflow(self::MONTHS_IN_TREND - 1)->startOfMonth();
        $range = [$startDate, now()->endOfMonth()];

        $rows = $this->applySalesFilters(Sale::query(), $branchId, $range, $paymentMethod)
            ->where('tbl_sales.status', '<>', Sale::STATUS_VOIDED)
            ->toBase()
            ->selectRaw("DATE_FORMAT(tbl_sales.created_at, '%Y-%m') as period")
            ->selectRaw('SUM(tbl_sales.net_amount - tbl_sales.refunded_amount) as revenue')
            ->groupBy('period')
            ->pluck('revenue', 'period');

        $labels = [];
        $values = [];

        for ($i = 0; $i < self::MONTHS_IN_TREND; $i++) {
            $month = $startDate->copy()->addMonthsNoOverflow($i);
            $labels[] = $month->format('m/Y');
            $values[] = round((float) ($rows[$month->format('Y-m')] ?? 0), 2);
        }

        return [
            'labels' => $labels,
            'values' => $values,
            'period' => 'monthly',
        ];
    }

    private function productBreakdown(?int $branchId, ?array $range, ?PaymentMethod $paymentMethod): array
    {
        // Group by the same normalized expression that is displayed, so NULL,
        // '' and whitespace-only forms collapse into one "Uncategorized" slice.
        $categorySql = "COALESCE(NULLIF(TRIM(tbl_products.form), ''), 'Uncategorized')";

        // A derived table is needed because ONLY_FULL_GROUP_BY rejects
        // grouping by an expression over a non-grouped column.
        $lines = $this->saleLinesQuery($branchId, $range, $paymentMethod)
            ->toBase()
            ->selectRaw("{$categorySql} as category")
            ->selectRaw($this->netLineRevenueSql().' as net_revenue');

        $rows = DB::query()
            ->fromSub($lines, 'lines')
            ->select('category')
            ->selectRaw('SUM(net_revenue) as revenue')
            ->groupBy('category')
            ->havingRaw('SUM(net_revenue) > 0')
            ->orderByDesc('revenue')
            ->orderBy('category')
            ->get();

        return [
            'labels' => $rows->pluck('category')->all(),
            'values' => $rows->pluck('revenue')->map(fn ($value) => round((float) $value, 2))->all(),
        ];
    }

    /**
     * Every listed branch (so zero-sale branches still show up for comparison),
     * filtered by period and payment method but deliberately not by the
     * selected branch.
     */
    private function branchPerformance(Collection $branches, ?array $range, ?PaymentMethod $paymentMethod): array
    {
        $totals = $this->applySalesFilters(Sale::query(), null, $range, $paymentMethod)
            ->where('tbl_sales.status', '<>', Sale::STATUS_VOIDED)
            ->toBase()
            ->select('tbl_sales.branch_id')
            ->selectRaw('SUM(tbl_sales.net_amount - tbl_sales.refunded_amount) as total_revenue')
            ->selectRaw('COUNT(*) as transaction_count')
            ->groupBy('tbl_sales.branch_id')
            ->get()
            ->keyBy('branch_id');

        return $branches
            ->map(function (Branch $branch) use ($totals) {
                $row = $totals->get($branch->id);

                return [
                    'id' => (int) $branch->id,
                    'branch_name' => $branch->branch_name,
                    'total_revenue' => round((float) ($row->total_revenue ?? 0), 2),
                    'transaction_count' => (int) ($row->transaction_count ?? 0),
                ];
            })
            ->values()
            ->all();
    }

    /* ─────────────────────────────── Misc ─────────────────────────────── */

    private function resolveBranchName(int $roleId, ?int $branchId, Collection $branches): ?string
    {
        if ($branchId === null) {
            return null;
        }

        if ($roleId === 1) {
            return Branch::query()->whereKey($branchId)->value('branch_name');
        }

        return $branches->firstWhere('id', $branchId)?->branch_name;
    }

    private function dashboardRouteName(int $roleId): string
    {
        return match ($roleId) {
            2 => 'admin-dashboard',
            3 => 'superadmin-dashboard',
            default => 'dashboard',
        };
    }

    private function branchIdOrFail(): int
    {
        $branchId = (int) session('branch_id');

        if ($branchId <= 0) {
            abort(403, 'No branch assigned to your session.');
        }

        return $branchId;
    }
}
