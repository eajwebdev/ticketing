<?php

namespace App\Support;

/**
 * Capability keys. Every team member can use Tasks and see the team; these gate the rest.
 * A user's effective permissions = their role's defaults, unless an admin saved a custom set.
 */
final class Permissions
{
    public const TICKETS = 'tickets.handle';        // work the ticket queue: accept, resolve, collaborate
    public const CLIENTS = 'clients.manage';        // add / approve / edit clients
    public const SYSTEMS_VIEW = 'systems.view';     // see client systems & due dates (no money)
    public const CREDENTIALS = 'credentials.view';  // see saved client logins
    public const BILLING = 'billing.manage';        // amounts, mark paid, sales
    public const ANALYTICS = 'analytics.view';
    public const TASKS_MANAGE = 'tasks.manage';     // edit/delete anyone's tasks
    public const LEADS = 'leads.manage';            // sales pipeline
    public const SETTINGS = 'settings.manage';      // users, roles, systems, categories (admin)

    public const ALL = [
        self::TICKETS, self::CLIENTS, self::SYSTEMS_VIEW, self::CREDENTIALS, self::BILLING,
        self::ANALYTICS, self::TASKS_MANAGE, self::LEADS, self::SETTINGS,
    ];

    public const LABELS = [
        self::TICKETS => ['Ticket queue', 'Accept, resolve and collaborate on client tickets'],
        self::CLIENTS => ['Clients', 'Add, approve and edit client accounts'],
        self::SYSTEMS_VIEW => ['Client systems', 'See which systems each client has and when they are due'],
        self::CREDENTIALS => ['System logins', 'See saved usernames & passwords (every view is logged)'],
        self::BILLING => ['Billing & sales', 'Amounts, mark as paid, sales reports'],
        self::ANALYTICS => ['Analytics', 'Support performance dashboards'],
        self::TASKS_MANAGE => ['Manage all tasks', 'Edit or delete anyone’s tasks (everyone can manage their own)'],
        self::LEADS => ['Leads pipeline', 'Track prospects and convert them to clients'],
        self::SETTINGS => ['Settings & users', 'Users, roles, systems, categories (owner-level)'],
    ];
}
