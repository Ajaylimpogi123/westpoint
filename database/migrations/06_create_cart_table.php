<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tbl_cart', function (Blueprint $table) {
            $table->id('ct_id');

            $table->unsignedBigInteger('table_id');

            $table->unsignedBigInteger('pd_id');

            $table->integer('table_number');

     
            $table->bigInteger('ct_qty')->default(1); // ✅ FIXED
            $table->decimal('ct_price', 9, 2)->default(0.00);

            $table->timestamp('ct_date')->nullable();
            $table->string('remark', 100)->default('');

            $table->Integer('user_id')->default(0);
            $table->Integer('merge_number')->default(0);

            $table->Integer('is_done')->default(0);
            $table->Integer('is_open')->default(0);
            $table->Integer('is_print')->default(0);
            $table->string('ct_status', 100)->default('');
            $table->timestamps();
       
            $table->softDeletes(); // ✅ better than manual deleted_at
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_cart');
    }
};
