<?php

namespace App\Enums;

enum Role: string
{
    case Customer = 'customer';
    case Agent = 'agent';
    case Admin = 'admin';

    public function isTeam(): bool
    {
        return $this === self::Agent || $this === self::Admin;
    }
}
