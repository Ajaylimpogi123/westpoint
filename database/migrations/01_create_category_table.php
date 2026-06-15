<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_category', function (Blueprint $table) {

          $table->id('cat_id');
        $table->string('cat_name', 50)->nullable();
        $table->string('cat_description', 200)->nullable();
        $table->string('cat_image', 255)->nullable();
        $table->unsignedTinyInteger('is_service')->default(0);
        $table->unsignedTinyInteger('printer_no')->default(0);
        $table->timestamps();
        $table->softDeletes();

        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_category');
    }
};
