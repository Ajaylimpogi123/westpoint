<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class CustomerReturn extends Model
{
    use HasFactory;

    protected $table = 'tbl_returns';
    protected $primaryKey = 'return_id';

    protected $fillable = [
        'customer_id',
        'branch_id',
        'return_date',
        'received_by',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'return_date' => 'date',
        ];
    }

    public function customer()
    {
        return $this->belongsTo(BranchCustomer::class, 'customer_id', 'customer_id');
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function items()
    {
        return $this->hasMany(CustomerReturnItem::class, 'return_id', 'return_id');
    }
}