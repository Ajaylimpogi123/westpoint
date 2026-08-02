<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

/**
 * Report is not backed by its own table. Every report here reads across
 * existing sales/inventory tables, so it's kept as a set of static query
 * builders rather than an Eloquent model tied to one table's PK/columns.
 */
class Report
{
    /**
     * Shared date-range + branch filter applied to every report.
     * Defaults to "today" if no dates are passed.
     */
    protected static function dateRange(array $filters): array
    {
        $from = $filters['date_from'] ?? Carbon::today()->toDateString();
        $to   = $filters['date_to'] ?? Carbon::today()->toDateString();

        return [$from, Carbon::parse($to)->endOfDay()];
    }

    protected static function applyBranch($query, array $filters, string $column = 'branch_id')
    {
        if (!empty($filters['branch_id'])) {
            $query->where($column, $filters['branch_id']);
        }

        return $query;
    }

    /* ───────────────────────── SALES ───────────────────────── */

    public static function salesSummary(array $filters): array
    {
        [$from, $to] = static::dateRange($filters);

        $query = DB::table('tbl_sales')
            ->whereBetween('created_at', [$from, $to]);

        static::applyBranch($query, $filters);

        $totals = (clone $query)->selectRaw('
                COUNT(*) as transaction_count,
                COALESCE(SUM(gross_amount), 0) as gross_amount,
                COALESCE(SUM(discount_amount), 0) as discount_amount,
                COALESCE(SUM(net_amount), 0) as net_amount
            ')->first();

        $byPaymentMethod = (clone $query)
            ->select('payment_method', DB::raw('COUNT(*) as count'), DB::raw('SUM(net_amount) as total'))
            ->groupBy('payment_method')
            ->get();

        $byDay = (clone $query)
            ->selectRaw('DATE(created_at) as sale_date, COUNT(*) as transaction_count, SUM(net_amount) as net_amount')
            ->groupBy('sale_date')
            ->orderBy('sale_date')
            ->get();

        return compact('totals', 'byPaymentMethod', 'byDay');
    }

   public static function salesDetail(array $filters)
{
    [$from, $to] = static::dateRange($filters);

    $query = DB::table('tbl_sales as s')
        ->leftJoin('users as u', 'u.id', '=', 's.user_id')
        ->leftJoin('branches as b', 'b.id', '=', 's.branch_id')
        ->whereBetween('s.created_at', [$from, $to])
        ->select(
            's.id',
            's.invoice_number',
            's.reference_number',
            's.customer_name',
            's.payment_method',
            's.gross_amount',
            's.discount_amount',
            's.net_amount',
            's.created_at',
            'u.name as cashier_name',
            'b.branch_name as branch_name'
        )
        ->orderByDesc('s.created_at');

    static::applyBranch($query, $filters, 's.branch_id');

    if (!empty($filters['user_id'])) {
        $query->where('s.user_id', $filters['user_id']);
    }

    if (!empty($filters['payment_method'])) {
        $query->where('s.payment_method', $filters['payment_method']);
    }

    return $query->paginate($filters['per_page'] ?? 25)->withQueryString();
}

   public static function topProducts(array $filters, int $limit = 20)
{
    [$from, $to] = static::dateRange($filters);

    $query = DB::table('tbl_sales_items as si')
        ->join('tbl_sales as s', 's.id', '=', 'si.sale_id')
        ->join('tbl_products as p', 'p.id', '=', 'si.product_id')
        ->whereBetween('s.created_at', [$from, $to])
        ->select(
            'p.id as product_id',
            'p.med_name',
            'p.brand_name',
            DB::raw('SUM(si.quantity_sold) as units_sold'),
            DB::raw('SUM(si.total_price) as revenue')
        )
        ->groupBy('p.id', 'p.med_name', 'p.brand_name')
        ->orderByDesc('revenue')
        ->limit($limit);

    static::applyBranch($query, $filters, 's.branch_id');

    return $query->get();
}

   public static function salesByCashier(array $filters)
{
    [$from, $to] = static::dateRange($filters);

    $query = DB::table('tbl_sales as s')
        ->join('users as u', 'u.id', '=', 's.user_id')
        ->whereBetween('s.created_at', [$from, $to])
        ->select(
            'u.id as user_id',
            'u.name as cashier_name',
            DB::raw('COUNT(s.id) as transaction_count'),
            DB::raw('SUM(s.net_amount) as net_amount')
        )
        ->groupBy('u.id', 'u.name')
        ->orderByDesc('net_amount');

    static::applyBranch($query, $filters, 's.branch_id');

    return $query->get();
}

    /* ─────────────────────── INVENTORY ─────────────────────── */

  public static function stockOnHand(array $filters)
{
    $query = DB::table('products_qty as pq')
        ->join('tbl_products as p', 'p.id', '=', 'pq.product_id')
        ->leftJoin('branches as b', 'b.id', '=', 'p.branch_id')
        ->where('pq.status', 'Active')
        ->select(
            'p.id as product_id',
            'p.med_name',
            'p.brand_name',
            'p.stock_threshold',
            'pq.lot_number',
            'pq.expiry',
            'pq.shelf_number',
            'pq.quantity',
            'b.branch_name as branch_name'
        )
        ->orderBy('p.med_name');

    static::applyBranch($query, $filters, 'p.branch_id');

    if (!empty($filters['product_id'])) {
        $query->where('p.id', $filters['product_id']);
    }

    if (!empty($filters['brand_name'])) {
        $query->where('p.brand_name', 'like', '%' . $filters['brand_name'] . '%');
    }

    if (!empty($filters['lot_number'])) {
        $query->where('pq.lot_number', 'like', '%' . $filters['lot_number'] . '%');
    }

    if (!empty($filters['shelf_number'])) {
        $query->where('pq.shelf_number', 'like', '%' . $filters['shelf_number'] . '%');
    }

    if (!empty($filters['expiry_from'])) {
        $query->where('pq.expiry', '>=', $filters['expiry_from']);
    }

    if (!empty($filters['expiry_to'])) {
        $query->where('pq.expiry', '<=', $filters['expiry_to']);
    }

    return $query->get();
}
    public static function lowStock(array $filters)
{
    $query = DB::table('tbl_products as p')
        ->leftJoin('products_qty as pq', function ($join) {
            $join->on('pq.product_id', '=', 'p.id')->where('pq.status', 'Active');
        })
        ->select(
            'p.id as product_id',
            'p.med_name',
            'p.brand_name',
            'p.stock_threshold',
            'p.branch_id',
            DB::raw('COALESCE(SUM(pq.quantity), 0) as total_quantity')
        )
        ->groupBy('p.id', 'p.med_name', 'p.brand_name', 'p.stock_threshold', 'p.branch_id')
        ->havingRaw('COALESCE(SUM(pq.quantity), 0) <= p.stock_threshold')
        ->orderBy('total_quantity');

    static::applyBranch($query, $filters, 'p.branch_id');

    return $query->get();
}

    public static function expiry(array $filters)
{
    $withinDays = $filters['within_days'] ?? 90;
    $cutoff = Carbon::today()->addDays($withinDays)->toDateString();

    $query = DB::table('products_qty as pq')
        ->join('tbl_products as p', 'p.id', '=', 'pq.product_id')
        ->where('pq.status', 'Active')
        ->whereNotNull('pq.expiry')
        ->where('pq.quantity', '>', 0)
        ->where('pq.expiry', '<=', $cutoff)
        ->select(
            'p.id as product_id',
            'p.med_name',
            'p.brand_name',
            'pq.lot_number',
            'pq.expiry',
            'pq.quantity',
            'p.branch_id',
            DB::raw('DATEDIFF(pq.expiry, CURDATE()) as days_to_expiry')
        )
        ->orderBy('pq.expiry');

    static::applyBranch($query, $filters, 'p.branch_id');

    return $query->get();
}
    /* ─────────────────── STOCK MOVEMENTS ─────────────────── */

   public static function stockInReport(array $filters)
{
    [$from, $to] = static::dateRange($filters);

    $query = DB::table('tbl_stock_in_items as sii')
        ->join('tbl_stock_ins as si', 'si.stock_in_id', '=', 'sii.stock_in_id')
        ->join('tbl_products as p', 'p.id', '=', 'sii.pd_id')
        ->whereBetween('si.delivery_date', [$from, $to])
        ->select(
            'si.stock_in_id',
            'si.supplier_name',
            'si.delivery_date',
            'si.received_by',
            'si.branch_id',
            'p.med_name',
            'sii.batch_number',
            'sii.expiry_date',
            'sii.unit_type',
            'sii.quantity_received',
            'sii.pieces_received',
            'sii.unit_price'
        )
        ->orderByDesc('si.delivery_date');

    static::applyBranch($query, $filters, 'si.branch_id');

    return $query->get();
}

    public static function stockOutReport(array $filters)
{
    [$from, $to] = static::dateRange($filters);

    $query = DB::table('tbl_stock_out_items as soi')
        ->join('tbl_stock_outs as so', 'so.stock_out_id', '=', 'soi.stock_out_id')
        ->join('tbl_products as p', 'p.id', '=', 'soi.pd_id')
        ->whereBetween('so.created_at', [$from, $to])
        ->select(
            'so.stock_out_id',
            'so.transaction_subtype',
            'so.patient_reference',
            'so.issued_by',
            'so.delivered_to',
            'so.delivery_confirmed',
            'so.branch_id',
            'p.med_name',
            'soi.lot_number',
            'soi.expiry',
            'soi.unit_type',
            'soi.quantity_deducted',
            'soi.pieces_deducted',
            'soi.unit_price',
            'so.created_at'
        )
        ->orderByDesc('so.created_at');

    static::applyBranch($query, $filters, 'so.branch_id');

    return $query->get();
}

 public static function stockTransferReport(array $filters)
{
    [$from, $to] = static::dateRange($filters);

    $query = DB::table('tbl_stock_transfers as t')
        ->leftJoin('branches as fb', 'fb.id', '=', 't.from_branch_id')
        ->leftJoin('branches as tb', 'tb.id', '=', 't.to_branch_id')
        ->leftJoin('users as req', 'req.id', '=', 't.requested_by')
        ->leftJoin('users as app', 'app.id', '=', 't.approved_by')
        ->whereBetween('t.transfer_date', [$from, $to])
        ->select(
            't.id',
            't.transfer_no',
            't.status',
            't.priority',
            't.transfer_date',
            't.needed_by',
            't.approved_at',
            'fb.branch_name as from_branch',
            'tb.branch_name as to_branch',
            'req.name as requested_by_name',
            'app.name as approved_by_name'
        )
        ->orderByDesc('t.transfer_date');

    if (!empty($filters['status'])) {
        $query->where('t.status', $filters['status']);
    }

    if (!empty($filters['branch_id'])) {
        $query->where(function ($q) use ($filters) {
            $q->where('t.from_branch_id', $filters['branch_id'])
              ->orWhere('t.to_branch_id', $filters['branch_id']);
        });
    }

    return $query->get();
}
    public static function movementLedger(array $filters)
{
    [$from, $to] = static::dateRange($filters);

    $query = DB::table('tbl_inventory_movement_logs as l')
        ->leftJoin('users as u', 'u.id', '=', 'l.performed_by')
        ->whereBetween('l.created_at', [$from, $to])
        ->select(
            'l.log_id',
            'l.movement_type',
            'l.reference_label',
            'l.medicine_name',
            'l.lot_number',
            'l.quantity',
            'l.remarks',
            'l.branch_id',
            'l.created_at',
            'u.name as performed_by_name'
        )
        ->orderByDesc('l.created_at');

    static::applyBranch($query, $filters, 'l.branch_id');

    if (!empty($filters['movement_type'])) {
        $query->where('l.movement_type', $filters['movement_type']);
    }

    return $query->paginate($filters['per_page'] ?? 50)->withQueryString();
}
}