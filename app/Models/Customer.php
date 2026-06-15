<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use HasFactory;
    use SoftDeletes;
    protected $table = 'tbl_customer';
    protected $primaryKey = 'cust_id';
    protected $fillable = [
        'cust_fname',
        'cust_lname',
        'contact_no',
        'cust_image',
    ];

        public function orders()
    {
        return $this->hasMany(Order::class, 'od_id', 'od_id');
    }
}
