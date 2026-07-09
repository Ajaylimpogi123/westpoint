<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BranchCustomer extends Model
{
    use HasFactory;

    protected $table = 'tbl_customers';

    protected $primaryKey = 'customer_id';

    protected $fillable = [
        'branch_id',
        'first_name',
        'last_name',
        'phone_number',
        'email',
        'address',
        'customer_type',
        'status',
        'created_by',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }
}
