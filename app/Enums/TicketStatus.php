<?php

namespace App\Enums;

enum TicketStatus: string
{
    case Open = 'open';
    case Accepted = 'accepted';
    case Resolved = 'resolved';
    case Closed = 'closed';
    case Reopened = 'reopened';
}
