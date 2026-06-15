<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Table extends Model
{
    use HasFactory;
    use SoftDeletes;
    protected $table = 'bs_table';
    protected $primaryKey = 'table_id';
    protected $fillable = [
        't_number',
        't_description',
        't_status',
    ];
    public function carts()
    {
        return $this->hasMany(Cart::class, 'table_id', 'table_id');
    }
}
