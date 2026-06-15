<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Category extends Model
{
    use HasFactory;
    use SoftDeletes;
    protected $table = 'tbl_category';
    protected $primaryKey = 'cat_id';
    protected $fillable = [
        'cat_name',
        'cat_description',
        'cat_image',
    ];

        public function products()
    {
        return $this->hasMany(Product::class, 'cat_id', 'cat_id');
    }
}
