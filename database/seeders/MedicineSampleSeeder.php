<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use Illuminate\Database\Seeder;

class MedicineSampleSeeder extends Seeder
{
    /**
     * Sample medicines for POS testing (search, filters, pagination, checkout).
     *
     * Run: php artisan db:seed --class=MedicineSampleSeeder
     */
    public function run(): void
    {
        $branch = Branch::firstOrCreate(['branch_name' => 'Main Branch']);

        foreach ($this->samples() as $index => $sample) {
            $product = MedicineProduct::updateOrCreate(
                [
                    'branch_id' => $branch->id,
                    'med_name' => $sample['med_name'],
                    'dose' => $sample['dose'],
                    'form' => $sample['form'],
                    'brand_name' => $sample['brand_name'],
                ],
                [
                    'category' => $sample['category'] ?? null,
                    'is_generic' => $sample['is_generic'] ?? false,
                    'pack_size' => $sample['pack_size'],
                    'retail_price' => $sample['retail_price'],
                    'wholesale_price' => $sample['wholesale_price'],
                    'status' => 'Active',
                ]
            );

            foreach ($sample['batches'] as $batchIndex => $batch) {
                ProductQty::updateOrCreate(
                    [
                        'product_id' => $product->id,
                        'lot_number' => $batch['lot_number'],
                    ],
                    [
                        'quantity' => $batch['quantity'],
                        'status' => 'Active',
                        'expiry' => $batch['expiry'],
                    ]
                );
            }
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function samples(): array
    {
        $lot = fn (int $n) => sprintf('LOT-%04d', $n);
        $exp = fn (int $months) => now()->addMonths($months)->toDateString();

        return [
            ['med_name' => 'Paracetamol', 'dose' => '500mg', 'form' => 'Tablet', 'brand_name' => 'Biogesic', 'category' => 'Analgesic', 'is_generic' => false, 'pack_size' => 10, 'retail_price' => 5.00, 'wholesale_price' => 42.00, 'batches' => [['lot_number' => $lot(1), 'quantity' => 240, 'expiry' => $exp(18)], ['lot_number' => $lot(2), 'quantity' => 120, 'expiry' => $exp(9)]]],
            ['med_name' => 'Paracetamol', 'dose' => '500mg', 'form' => 'Tablet', 'brand_name' => 'Tempra', 'category' => 'Analgesic', 'is_generic' => true, 'pack_size' => 20, 'retail_price' => 3.50, 'wholesale_price' => 60.00, 'batches' => [['lot_number' => $lot(3), 'quantity' => 180, 'expiry' => $exp(14)]]],
            ['med_name' => 'Ibuprofen', 'dose' => '200mg', 'form' => 'Tablet', 'brand_name' => 'Medicol', 'category' => 'NSAID', 'is_generic' => false, 'pack_size' => 10, 'retail_price' => 8.00, 'wholesale_price' => 68.00, 'batches' => [['lot_number' => $lot(4), 'quantity' => 150, 'expiry' => $exp(16)]]],
            ['med_name' => 'Mefenamic Acid', 'dose' => '500mg', 'form' => 'Capsule', 'brand_name' => 'Ponstan', 'category' => 'NSAID', 'is_generic' => false, 'pack_size' => 10, 'retail_price' => 12.00, 'wholesale_price' => 105.00, 'batches' => [['lot_number' => $lot(5), 'quantity' => 90, 'expiry' => $exp(12)]]],
            ['med_name' => 'Amoxicillin', 'dose' => '500mg', 'form' => 'Capsule', 'brand_name' => 'Amoxil', 'category' => 'Antibiotic', 'is_generic' => false, 'pack_size' => 21, 'retail_price' => 15.00, 'wholesale_price' => 280.00, 'batches' => [['lot_number' => $lot(6), 'quantity' => 84, 'expiry' => $exp(10)]]],
            ['med_name' => 'Amoxicillin', 'dose' => '250mg/5ml', 'form' => 'Syrup', 'brand_name' => 'Amoxil', 'category' => 'Antibiotic', 'is_generic' => false, 'pack_size' => 1, 'retail_price' => 185.00, 'wholesale_price' => 165.00, 'batches' => [['lot_number' => $lot(7), 'quantity' => 24, 'expiry' => $exp(8)]]],
            ['med_name' => 'Azithromycin', 'dose' => '500mg', 'form' => 'Film-coated tablet', 'brand_name' => 'Zithromax', 'category' => 'Antibiotic', 'is_generic' => false, 'pack_size' => 3, 'retail_price' => 95.00, 'wholesale_price' => 260.00, 'batches' => [['lot_number' => $lot(8), 'quantity' => 60, 'expiry' => $exp(20)]]],
            ['med_name' => 'Cefalexin', 'dose' => '500mg', 'form' => 'Capsule', 'brand_name' => 'Keflex', 'category' => 'Antibiotic', 'is_generic' => true, 'pack_size' => 20, 'retail_price' => 18.00, 'wholesale_price' => 320.00, 'batches' => [['lot_number' => $lot(9), 'quantity' => 100, 'expiry' => $exp(11)]]],
            ['med_name' => 'Cetirizine', 'dose' => '10mg', 'form' => 'Tablet', 'brand_name' => 'Zyrcet', 'category' => 'Antihistamine', 'is_generic' => true, 'pack_size' => 10, 'retail_price' => 4.50, 'wholesale_price' => 38.00, 'batches' => [['lot_number' => $lot(10), 'quantity' => 200, 'expiry' => $exp(22)]]],
            ['med_name' => 'Loratadine', 'dose' => '10mg', 'form' => 'Tablet', 'brand_name' => 'Claritin', 'category' => 'Antihistamine', 'is_generic' => false, 'pack_size' => 10, 'retail_price' => 9.00, 'wholesale_price' => 72.00, 'batches' => [['lot_number' => $lot(11), 'quantity' => 130, 'expiry' => $exp(15)]]],
            ['med_name' => 'Ambroxol', 'dose' => '30mg', 'form' => 'Tablet', 'brand_name' => 'Mucosolvan', 'category' => 'Expectorant', 'is_generic' => false, 'pack_size' => 20, 'retail_price' => 7.00, 'wholesale_price' => 115.00, 'batches' => [['lot_number' => $lot(12), 'quantity' => 160, 'expiry' => $exp(13)]]],
            ['med_name' => 'Carbocisteine', 'dose' => '500mg', 'form' => 'Capsule', 'brand_name' => 'Solmux', 'category' => 'Expectorant', 'is_generic' => false, 'pack_size' => 10, 'retail_price' => 6.50, 'wholesale_price' => 55.00, 'batches' => [['lot_number' => $lot(13), 'quantity' => 110, 'expiry' => $exp(17)]]],
            ['med_name' => 'Salbutamol', 'dose' => '2mg', 'form' => 'Tablet', 'brand_name' => 'Ventolin', 'category' => 'Bronchodilator', 'is_generic' => false, 'pack_size' => 30, 'retail_price' => 5.50, 'wholesale_price' => 140.00, 'batches' => [['lot_number' => $lot(14), 'quantity' => 75, 'expiry' => $exp(19)]]],
            ['med_name' => 'Salbutamol', 'dose' => '100mcg', 'form' => 'Medical Supply', 'brand_name' => 'Ventolin Inhaler', 'category' => 'Bronchodilator', 'is_generic' => false, 'pack_size' => 1, 'retail_price' => 520.00, 'wholesale_price' => 480.00, 'batches' => [['lot_number' => $lot(15), 'quantity' => 18, 'expiry' => $exp(24)]]],
            ['med_name' => 'Omeprazole', 'dose' => '20mg', 'form' => 'Capsule', 'brand_name' => 'Losec', 'category' => 'Antacid', 'is_generic' => false, 'pack_size' => 14, 'retail_price' => 14.00, 'wholesale_price' => 165.00, 'batches' => [['lot_number' => $lot(16), 'quantity' => 98, 'expiry' => $exp(21)]]],
            ['med_name' => 'Hyoscine N-butylbromide', 'dose' => '10mg', 'form' => 'Tablet', 'brand_name' => 'Buscopan', 'category' => 'Antispasmodic', 'is_generic' => false, 'pack_size' => 10, 'retail_price' => 11.00, 'wholesale_price' => 92.00, 'batches' => [['lot_number' => $lot(17), 'quantity' => 85, 'expiry' => $exp(14)]]],
            ['med_name' => 'Loperamide', 'dose' => '2mg', 'form' => 'Capsule', 'brand_name' => 'Diatabs', 'category' => 'Antidiarrheal', 'is_generic' => false, 'pack_size' => 8, 'retail_price' => 6.00, 'wholesale_price' => 42.00, 'batches' => [['lot_number' => $lot(18), 'quantity' => 140, 'expiry' => $exp(16)]]],
            ['med_name' => 'Oral Rehydration Salts', 'dose' => '4.2g', 'form' => 'Powder', 'brand_name' => 'Hydrite', 'category' => 'Rehydration', 'is_generic' => true, 'pack_size' => 1, 'retail_price' => 12.00, 'wholesale_price' => 9.50, 'batches' => [['lot_number' => $lot(19), 'quantity' => 200, 'expiry' => $exp(30)]]],
            ['med_name' => 'Ascorbic Acid', 'dose' => '500mg', 'form' => 'Tablet', 'brand_name' => 'Ceelin', 'category' => 'Vitamin', 'is_generic' => false, 'pack_size' => 10, 'retail_price' => 4.00, 'wholesale_price' => 32.00, 'batches' => [['lot_number' => $lot(20), 'quantity' => 300, 'expiry' => $exp(24)]]],
            ['med_name' => 'Multivitamins', 'dose' => 'Adult', 'form' => 'Capsule', 'brand_name' => 'Enervon', 'category' => 'Vitamin', 'is_generic' => false, 'pack_size' => 30, 'retail_price' => 9.50, 'wholesale_price' => 245.00, 'batches' => [['lot_number' => $lot(21), 'quantity' => 66, 'expiry' => $exp(18)]]],
            ['med_name' => 'Metformin', 'dose' => '500mg', 'form' => 'Tablet', 'brand_name' => 'Glucophage', 'category' => 'Antidiabetic', 'is_generic' => false, 'pack_size' => 30, 'retail_price' => 6.00, 'wholesale_price' => 150.00, 'batches' => [['lot_number' => $lot(22), 'quantity' => 120, 'expiry' => $exp(20)]]],
            ['med_name' => 'Losartan', 'dose' => '50mg', 'form' => 'Tablet', 'brand_name' => 'Cozaar', 'category' => 'Antihypertensive', 'is_generic' => false, 'pack_size' => 30, 'retail_price' => 8.50, 'wholesale_price' => 220.00, 'batches' => [['lot_number' => $lot(23), 'quantity' => 95, 'expiry' => $exp(22)]]],
            ['med_name' => 'Amlodipine', 'dose' => '5mg', 'form' => 'Tablet', 'brand_name' => 'Norvasc', 'category' => 'Antihypertensive', 'is_generic' => false, 'pack_size' => 30, 'retail_price' => 7.50, 'wholesale_price' => 195.00, 'batches' => [['lot_number' => $lot(24), 'quantity' => 88, 'expiry' => $exp(19)]]],
            ['med_name' => 'Atorvastatin', 'dose' => '20mg', 'form' => 'Tablet', 'brand_name' => 'Lipitor', 'category' => 'Cholesterol', 'is_generic' => false, 'pack_size' => 30, 'retail_price' => 16.00, 'wholesale_price' => 420.00, 'batches' => [['lot_number' => $lot(25), 'quantity' => 72, 'expiry' => $exp(23)]]],
            ['med_name' => 'Clopidogrel', 'dose' => '75mg', 'form' => 'Tablet', 'brand_name' => 'Plavix', 'category' => 'Antiplatelet', 'is_generic' => false, 'pack_size' => 28, 'retail_price' => 22.00, 'wholesale_price' => 560.00, 'batches' => [['lot_number' => $lot(26), 'quantity' => 56, 'expiry' => $exp(21)]]],
            ['med_name' => 'Insulin Glargine', 'dose' => '100IU/ml', 'form' => 'Vial', 'brand_name' => 'Lantus', 'category' => 'Antidiabetic', 'is_generic' => false, 'pack_size' => 1, 'retail_price' => 980.00, 'wholesale_price' => 920.00, 'batches' => [['lot_number' => $lot(27), 'quantity' => 12, 'expiry' => $exp(6)]]],
            ['med_name' => 'Betamethasone', 'dose' => '0.1%', 'form' => 'Cream', 'brand_name' => 'Dermovate', 'category' => 'Dermatologic', 'is_generic' => false, 'pack_size' => 1, 'retail_price' => 145.00, 'wholesale_price' => 125.00, 'batches' => [['lot_number' => $lot(28), 'quantity' => 30, 'expiry' => $exp(15)]]],
            ['med_name' => 'Mupirocin', 'dose' => '2%', 'form' => 'Ointment', 'brand_name' => 'Bactroban', 'category' => 'Antibiotic', 'is_generic' => false, 'pack_size' => 1, 'retail_price' => 210.00, 'wholesale_price' => 185.00, 'batches' => [['lot_number' => $lot(29), 'quantity' => 22, 'expiry' => $exp(12)]]],
            ['med_name' => 'Chloramphenicol', 'dose' => '0.5%', 'form' => 'Eye drops', 'brand_name' => 'Chloromycetin', 'category' => 'Ophthalmic', 'is_generic' => true, 'pack_size' => 1, 'retail_price' => 85.00, 'wholesale_price' => 72.00, 'batches' => [['lot_number' => $lot(30), 'quantity' => 28, 'expiry' => $exp(10)]]],
            ['med_name' => 'Ciprofloxacin', 'dose' => '0.3%', 'form' => 'Otic drops', 'brand_name' => 'Ciloxan', 'category' => 'Otic', 'is_generic' => false, 'pack_size' => 1, 'retail_price' => 165.00, 'wholesale_price' => 148.00, 'batches' => [['lot_number' => $lot(31), 'quantity' => 16, 'expiry' => $exp(9)]]],
            ['med_name' => 'Diclofenac', 'dose' => '75mg/3ml', 'form' => 'Ampule', 'brand_name' => 'Voltaren', 'category' => 'NSAID', 'is_generic' => false, 'pack_size' => 5, 'retail_price' => 55.00, 'wholesale_price' => 240.00, 'batches' => [['lot_number' => $lot(32), 'quantity' => 40, 'expiry' => $exp(8)]]],
            ['med_name' => 'Ranitidine', 'dose' => '50mg/2ml', 'form' => 'Injection', 'brand_name' => 'Zantac', 'category' => 'Antacid', 'is_generic' => true, 'pack_size' => 5, 'retail_price' => 48.00, 'wholesale_price' => 210.00, 'batches' => [['lot_number' => $lot(33), 'quantity' => 35, 'expiry' => $exp(7)]]],
            ['med_name' => 'Nitrofurantoin', 'dose' => '100mg', 'form' => 'Capsule', 'brand_name' => 'Macrodantin', 'category' => 'Antibiotic', 'is_generic' => false, 'pack_size' => 14, 'retail_price' => 13.00, 'wholesale_price' => 158.00, 'batches' => [['lot_number' => $lot(34), 'quantity' => 70, 'expiry' => $exp(14)]]],
            ['med_name' => 'Fluconazole', 'dose' => '150mg', 'form' => 'Capsule', 'brand_name' => 'Diflucan', 'category' => 'Antifungal', 'is_generic' => false, 'pack_size' => 1, 'retail_price' => 125.00, 'wholesale_price' => 108.00, 'batches' => [['lot_number' => $lot(35), 'quantity' => 45, 'expiry' => $exp(16)]]],
            ['med_name' => 'Clotrimazole', 'dose' => '100mg', 'form' => 'Suppository', 'brand_name' => 'Canesten', 'category' => 'Antifungal', 'is_generic' => false, 'pack_size' => 6, 'retail_price' => 18.00, 'wholesale_price' => 92.00, 'batches' => [['lot_number' => $lot(36), 'quantity' => 54, 'expiry' => $exp(13)]]],
            ['med_name' => 'Zinc Sulfate', 'dose' => '20mg', 'form' => 'Syrup', 'brand_name' => 'Zincavit', 'category' => 'Supplement', 'is_generic' => true, 'pack_size' => 1, 'retail_price' => 95.00, 'wholesale_price' => 82.00, 'batches' => [['lot_number' => $lot(37), 'quantity' => 36, 'expiry' => $exp(11)]]],
            ['med_name' => 'Dextromethorphan', 'dose' => '15mg/5ml', 'form' => 'Syrup', 'brand_name' => 'Robitussin', 'category' => 'Antitussive', 'is_generic' => false, 'pack_size' => 1, 'retail_price' => 118.00, 'wholesale_price' => 102.00, 'batches' => [['lot_number' => $lot(38), 'quantity' => 32, 'expiry' => $exp(10)]]],
            ['med_name' => 'Guaifenesin', 'dose' => '100mg', 'form' => 'Tablet', 'brand_name' => 'Robitussin', 'category' => 'Expectorant', 'is_generic' => true, 'pack_size' => 20, 'retail_price' => 5.00, 'wholesale_price' => 78.00, 'batches' => [['lot_number' => $lot(39), 'quantity' => 125, 'expiry' => $exp(17)]]],
            ['med_name' => 'Tranexamic Acid', 'dose' => '500mg', 'form' => 'Capsule', 'brand_name' => 'Hemostan', 'category' => 'Hemostatic', 'is_generic' => false, 'pack_size' => 10, 'retail_price' => 19.00, 'wholesale_price' => 165.00, 'batches' => [['lot_number' => $lot(40), 'quantity' => 48, 'expiry' => $exp(15)]]],
            ['med_name' => 'Ferrous Sulfate', 'dose' => '325mg', 'form' => 'Tablet', 'brand_name' => 'Sangobion', 'category' => 'Supplement', 'is_generic' => false, 'pack_size' => 30, 'retail_price' => 6.50, 'wholesale_price' => 168.00, 'batches' => [['lot_number' => $lot(41), 'quantity' => 102, 'expiry' => $exp(20)]]],
            ['med_name' => 'Calcium Carbonate', 'dose' => '500mg', 'form' => 'Tablet', 'brand_name' => 'Caltrate', 'category' => 'Supplement', 'is_generic' => true, 'pack_size' => 30, 'retail_price' => 4.50, 'wholesale_price' => 115.00, 'batches' => [['lot_number' => $lot(42), 'quantity' => 155, 'expiry' => $exp(26)]]],
            ['med_name' => 'Naproxen', 'dose' => '250mg', 'form' => 'Tablet', 'brand_name' => 'Naprosyn', 'category' => 'NSAID', 'is_generic' => false, 'pack_size' => 10, 'retail_price' => 10.00, 'wholesale_price' => 88.00, 'batches' => [['lot_number' => $lot(43), 'quantity' => 92, 'expiry' => $exp(18)]]],
            ['med_name' => 'Prednisone', 'dose' => '10mg', 'form' => 'Tablet', 'brand_name' => 'Presone', 'category' => 'Corticosteroid', 'is_generic' => true, 'pack_size' => 20, 'retail_price' => 4.00, 'wholesale_price' => 68.00, 'batches' => [['lot_number' => $lot(44), 'quantity' => 118, 'expiry' => $exp(19)]]],
            ['med_name' => 'Montelukast', 'dose' => '10mg', 'form' => 'Film-coated tablet', 'brand_name' => 'Singulair', 'category' => 'Antiasthma', 'is_generic' => false, 'pack_size' => 14, 'retail_price' => 24.00, 'wholesale_price' => 310.00, 'batches' => [['lot_number' => $lot(45), 'quantity' => 63, 'expiry' => $exp(22)]]],
            ['med_name' => 'Budesonide', 'dose' => '200mcg', 'form' => 'Medical Supply', 'brand_name' => 'Pulmicort Inhaler', 'category' => 'Antiasthma', 'is_generic' => false, 'pack_size' => 1, 'retail_price' => 890.00, 'wholesale_price' => 820.00, 'batches' => [['lot_number' => $lot(46), 'quantity' => 10, 'expiry' => $exp(14)]]],
            ['med_name' => 'Alcohol', 'dose' => '70%', 'form' => 'Medical Supply', 'brand_name' => 'Generics', 'category' => 'Disinfectant', 'is_generic' => true, 'pack_size' => 1, 'retail_price' => 35.00, 'wholesale_price' => 28.00, 'batches' => [['lot_number' => $lot(47), 'quantity' => 80, 'expiry' => $exp(36)]]],
            ['med_name' => 'Face Mask', 'dose' => '3-Ply', 'form' => 'Medical Supply', 'brand_name' => 'SafeMask', 'category' => 'PPE', 'is_generic' => false, 'pack_size' => 50, 'retail_price' => 2.50, 'wholesale_price' => 95.00, 'batches' => [['lot_number' => $lot(48), 'quantity' => 500, 'expiry' => $exp(48)]]],
            ['med_name' => 'Digital Thermometer', 'dose' => 'Standard', 'form' => 'Medical Supply', 'brand_name' => 'Omron', 'category' => 'Device', 'is_generic' => false, 'pack_size' => 1, 'retail_price' => 250.00, 'wholesale_price' => 210.00, 'batches' => [['lot_number' => $lot(49), 'quantity' => 15, 'expiry' => $exp(60)]]],
            ['med_name' => 'Bioflu', 'dose' => '500mg', 'form' => 'Tablet', 'brand_name' => 'Bioflu', 'category' => 'Cold & Flu', 'is_generic' => false, 'pack_size' => 10, 'retail_price' => 7.00, 'wholesale_price' => 58.00, 'batches' => [['lot_number' => $lot(50), 'quantity' => 175, 'expiry' => $exp(16)]]],
            ['med_name' => 'Neozep', 'dose' => '500mg', 'form' => 'Tablet', 'brand_name' => 'Neozep', 'category' => 'Cold & Flu', 'is_generic' => false, 'pack_size' => 10, 'retail_price' => 6.50, 'wholesale_price' => 52.00, 'batches' => [['lot_number' => $lot(51), 'quantity' => 188, 'expiry' => $exp(15)]]],
            ['med_name' => 'Decolgen', 'dose' => 'Fort', 'form' => 'Capsule', 'brand_name' => 'Decolgen', 'category' => 'Cold & Flu', 'is_generic' => false, 'pack_size' => 10, 'retail_price' => 6.00, 'wholesale_price' => 48.00, 'batches' => [['lot_number' => $lot(52), 'quantity' => 210, 'expiry' => $exp(14)]]],
            ['med_name' => 'Co-Amoxiclav', 'dose' => '625mg', 'form' => 'Tablet', 'brand_name' => 'Augmentin', 'category' => 'Antibiotic', 'is_generic' => false, 'pack_size' => 14, 'retail_price' => 28.00, 'wholesale_price' => 360.00, 'batches' => [['lot_number' => $lot(53), 'quantity' => 52, 'expiry' => $exp(11)]]],
            ['med_name' => 'Phenylephrine', 'dose' => '10mg', 'form' => 'Tablet', 'brand_name' => 'Sudafed', 'category' => 'Decongestant', 'is_generic' => true, 'pack_size' => 10, 'retail_price' => 5.50, 'wholesale_price' => 46.00, 'batches' => [['lot_number' => $lot(54), 'quantity' => 8, 'expiry' => $exp(12)]]],
            ['med_name' => 'Hydrocortisone', 'dose' => '1%', 'form' => 'Cream', 'brand_name' => 'Hytone', 'category' => 'Dermatologic', 'is_generic' => true, 'pack_size' => 1, 'retail_price' => 78.00, 'wholesale_price' => 65.00, 'batches' => [['lot_number' => $lot(55), 'quantity' => 5, 'expiry' => $exp(10)]]],
        ];
    }
}
