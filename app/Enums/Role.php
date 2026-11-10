<?php

namespace App\Enums;

use App\Support\Permissions;

enum Role: string
{
    case Customer = 'customer';
    case Admin = 'admin';          // Owner / Lead — full access
    case Manager = 'manager';
    case Developer = 'developer';
    case Designer = 'designer';
    case Qa = 'qa';
    case Support = 'support';
    case Marketing = 'marketing';
    case Finance = 'finance';

    public function isTeam(): bool
    {
        return $this !== self::Customer;
    }

    public function label(): string
    {
        return match ($this) {
            self::Customer => 'Client',
            self::Admin => 'Owner / Admin',
            self::Manager => 'Project Manager',
            self::Developer => 'Developer',
            self::Designer => 'Designer',
            self::Qa => 'QA / Tester',
            self::Support => 'Support',
            self::Marketing => 'Marketing',
            self::Finance => 'Finance',
        };
    }

    /** What this role can do out of the box. An admin can fine-tune it per person. */
    public function defaultPermissions(): array
    {
        return match ($this) {
            self::Customer => [],
            self::Admin => Permissions::ALL,
            self::Manager => [
                Permissions::TICKETS, Permissions::CLIENTS, Permissions::SYSTEMS_VIEW,
                Permissions::ANALYTICS, Permissions::TASKS_MANAGE, Permissions::LEADS,
            ],
            self::Developer => [Permissions::TICKETS, Permissions::SYSTEMS_VIEW],
            self::Designer => [],
            self::Qa => [Permissions::TICKETS],
            self::Support => [Permissions::TICKETS, Permissions::CLIENTS, Permissions::SYSTEMS_VIEW],
            self::Marketing => [Permissions::LEADS, Permissions::CLIENTS],
            self::Finance => [Permissions::BILLING, Permissions::SYSTEMS_VIEW, Permissions::ANALYTICS],
        };
    }

    /** @return array<string> */
    public static function teamValues(): array
    {
        return array_values(array_map(fn ($r) => $r->value, array_filter(self::cases(), fn ($r) => $r->isTeam())));
    }
}
