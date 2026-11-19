<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Things the company pays for and must renew on time: domains, hosting, VPS, SSL…
 * Optionally linked to the client system they serve. Expiry alerts go to Owner/Admin users.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20)->index();                 // domain | hosting | vps | ssl | email | software | other
            $table->string('name');                              // e.g. juanlaundry.com, "Hostinger Business"
            $table->string('provider')->nullable();              // Namecheap, Hostinger, DigitalOcean…
            $table->foreignId('client_system_id')->nullable()->constrained('client_systems')->nullOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('paid_by', 10)->default('company');   // company | client
            $table->decimal('cost', 12, 2)->nullable();
            $table->string('billing_cycle', 20)->default('yearly');
            $table->date('expires_on')->index();
            $table->boolean('auto_renew')->default(false);
            $table->string('status', 20)->default('active')->index(); // active | cancelled
            $table->string('login_url')->nullable();
            $table->string('account')->nullable();               // which login/email the account is under
            $table->text('notes')->nullable();
            // Alert bookkeeping: the smallest "days before" stage already alerted for the
            // current expiry date, and the last day an alert went out (for daily expired alerts).
            $table->unsignedSmallInteger('last_alert_stage')->nullable();
            $table->date('last_alerted_on')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
