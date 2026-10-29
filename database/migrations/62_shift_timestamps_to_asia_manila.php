<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * D7: the app moves from UTC to Asia/Manila (UTC+8, no DST).
 *
 * Laravel wrote every timestamp below as UTC wall-clock time. After the
 * switch it reads them as Manila time, so existing rows are moved +8 hours to
 * keep meaning the same instant. down() moves them back.
 *
 * Only datetime/timestamp columns are touched. DATE columns (delivery_date,
 * expiry, transfer_date, qt_date, date_signed, ...) hold calendar dates
 * entered by users and are deliberately not shifted. Framework-transient
 * tables (sessions, cache, jobs, failed_jobs, password_reset_tokens) are left
 * alone. tbl_quotation.time_printed is a preformatted string and cannot be
 * shifted.
 *
 * All columns of a table are updated in one statement, so a TIMESTAMP column
 * with an implicit ON UPDATE CURRENT_TIMESTAMP (possible on MariaDB with
 * explicit_defaults_for_timestamp=OFF) is set explicitly and not overwritten.
 *
 * Must run exactly once, together with APP_TIMEZONE=Asia/Manila. See
 * .claude/handoff/qa-fix-batch-1.md (D7) for the deploy steps.
 */
return new class extends Migration
{
    private const HOURS = 8;

    /** @var array<string, list<string>> */
    private const COLUMNS = [
        'branches' => ['created_at', 'updated_at', 'deleted_at'],
        'users' => ['email_verified_at', 'created_at', 'updated_at'],
        'roles' => ['created_at', 'updated_at'],
        'products_qty' => ['created_at', 'updated_at'],
        'tbl_products' => ['created_at', 'updated_at'],
        'tbl_customers' => ['created_at', 'updated_at'],
        'tbl_carts' => ['created_at', 'updated_at'],
        'tbl_cart_items' => ['created_at', 'updated_at'],
        'tbl_document_sequences' => ['created_at', 'updated_at'],
        'tbl_idempotency_keys' => ['created_at', 'updated_at'],
        'tbl_inventory_movement_logs' => ['created_at', 'updated_at'],
        'tbl_quotation' => ['created_at', 'updated_at'],
        'tbl_quotation_items' => ['created_at', 'updated_at'],
        'tbl_returns' => ['created_at', 'updated_at'],
        'tbl_return_items' => ['created_at', 'updated_at'],
        'tbl_sales' => ['created_at', 'updated_at'],
        'tbl_sales_items' => ['created_at', 'updated_at'],
        'tbl_sale_item_allocations' => ['created_at', 'updated_at'],
        'tbl_sale_returns' => ['created_at', 'updated_at'],
        'tbl_sale_return_items' => ['created_at', 'updated_at'],
        'tbl_stock_ins' => ['created_at', 'updated_at'],
        'tbl_stock_in_items' => ['created_at', 'updated_at'],
        'tbl_stock_outs' => ['created_at', 'updated_at'],
        'tbl_stock_out_items' => ['created_at', 'updated_at'],
        'tbl_stock_transfers' => ['approved_at', 'created_at', 'updated_at'],
        'tbl_stock_transfer_items' => ['created_at', 'updated_at'],
        'tbl_stock_transfer_logs' => ['created_at'],
        // Legacy restaurant-template tables (routes removed in D6, tables kept).
        'bs_table' => ['created_at', 'updated_at', 'deleted_at'],
        'tbl_cart' => ['ct_date', 'created_at', 'updated_at', 'deleted_at'],
        'tbl_category' => ['created_at', 'updated_at', 'deleted_at'],
        'tbl_customer' => ['created_at', 'updated_at', 'deleted_at'],
        'tbl_order' => ['created_at', 'updated_at'],
        'tbl_order_items' => ['created_at', 'updated_at'],
        'tbl_product' => ['created_at', 'updated_at', 'deleted_at'],
    ];

    public function up(): void
    {
        $this->shift('+');
    }

    public function down(): void
    {
        $this->shift('-');
    }

    private function shift(string $sign): void
    {
        // All-or-nothing: a failure part-way must not leave some tables
        // shifted, or re-running would move them a second time.
        DB::transaction(fn () => $this->shiftTables($sign));
    }

    private function shiftTables(string $sign): void
    {
        foreach (self::COLUMNS as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $present = array_values(array_filter(
                $columns,
                fn (string $column) => Schema::hasColumn($table, $column),
            ));

            if ($present === []) {
                continue;
            }

            $assignments = implode(', ', array_map(
                fn (string $column) => "`{$column}` = `{$column}` {$sign} INTERVAL ".self::HOURS.' HOUR',
                $present,
            ));

            DB::statement("UPDATE `{$table}` SET {$assignments}");
        }
    }
};
