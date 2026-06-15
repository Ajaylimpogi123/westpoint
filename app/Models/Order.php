<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Order extends Model
{
    use HasFactory;

    protected $table = 'tbl_order';
    protected $primaryKey = 'od_id';
    
    protected $fillable = [
        'cust_id',
        'table_id',
        'table_number',
        'invoice_no',
        'payment_method',
        'order_description',
        'od_amount_due',
        'od_discount',
        'percent_discount',
        'od_total_amt_due',
        'od_payment',
        'od_change',
        'other_charges',
        'is_open',
        'is_print',
        'od_remarks',
        'od_date',
    ];

    protected $casts = [
        'od_date' => 'datetime',
        'od_amount_due' => 'decimal:2',
        'od_discount' => 'decimal:2',
        'percent_discount' => 'decimal:2',
        'od_total_amt_due' => 'decimal:2',
        'od_payment' => 'decimal:2',
        'od_change' => 'decimal:2',
        'other_charges' => 'decimal:2',
        'is_open' => 'boolean',
        'is_print' => 'boolean',
    ];

    // Relationship with OrderItems (plural model name)
    public function items()
    {
        return $this->hasMany(OrderItems::class, 'od_id', 'od_id');
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class, 'cust_id', 'cust_id');
    }

    public function table()
    {
        return $this->belongsTo(Table::class, 'table_id', 'table_id');
    }
}