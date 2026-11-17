<?php

namespace App\Support;

/**
 * The EAJ systems we sell and support — used by the seeder (fresh installs)
 * and the data migration that brings existing servers up to date.
 * Icons are keys of resources/js/lib/systemIcons.js.
 */
final class DefaultSystems
{
    public static function all(): array
    {
        return [
            ['name' => 'Laundry Management System', 'icon' => 'WashingMachine',
                'description' => 'Job orders, claim tags, pickup & delivery, and daily sales for laundry shops.'],
            ['name' => 'Grocery POS', 'icon' => 'ShoppingCart',
                'description' => 'Fast barcode checkout, stock levels and sales reports for groceries and mini-marts.'],
            ['name' => 'Cafe & Restaurant POS', 'icon' => 'UtensilsCrossed',
                'description' => 'Table and take-out orders, kitchen tickets, menu and ingredient inventory.'],
            ['name' => 'Inventory Management System', 'icon' => 'Boxes',
                'description' => 'Stock in/out, suppliers, purchase orders and multi-branch inventory tracking.'],
            ['name' => 'Pharmacy Management System', 'icon' => 'Pill',
                'description' => 'Dispensing, expiry and batch tracking, senior/PWD discounts and pharmacy sales.'],
            ['name' => 'Company Website', 'icon' => 'Globe',
                'description' => 'Professional websites for your business — design, hosting, updates and support.'],
            ['name' => 'Hardware Store Management System', 'icon' => 'Hammer',
                'description' => 'POS and inventory for hardware stores — items by unit, pricing, suppliers and credit.'],
            ['name' => 'Construction ERP', 'icon' => 'HardHat',
                'description' => 'Projects, materials, manpower, costing and progress billing for contractors.'],
            ['name' => 'Human Resource Management System', 'icon' => 'Users',
                'description' => 'Employee records, attendance, leave and payroll in one place.'],
            ['name' => 'Water Refilling Station System', 'icon' => 'Droplets',
                'description' => 'Refill and delivery orders, container tracking, customers and daily sales.'],
            ['name' => 'Condo & Resort Management System', 'icon' => 'Hotel',
                'description' => 'Bookings, units and rooms, tenant billing, dues and front-desk operations.'],
        ];
    }

    /** Old names on existing servers => the new name they become. */
    public static function renamed(): array
    {
        return [
            'Restaurant POS' => 'Cafe & Restaurant POS',
            'Cafe POS' => 'Cafe & Restaurant POS', // merged into the combined POS
            'Water Refilling Management System' => 'Water Refilling Station System',
        ];
    }
}
