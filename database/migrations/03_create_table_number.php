<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('bs_table', function (Blueprint $table) {
              // INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY
            $table->id('table_id')->primary();

            // VARCHAR(100) NULL
            $table->string('t_number', 100)->nullable();

            // VARCHAR(100) NULL
            $table->string('t_description', 200)->nullable();
            $table->string('t_status', 200)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bs_table');
    }
};
