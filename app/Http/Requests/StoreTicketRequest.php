<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'system_type_id' => ['nullable', 'exists:system_types,id'],
            'client_system_id' => ['nullable', 'exists:client_systems,id'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'urgency_id' => ['nullable', 'exists:urgency_levels,id'],
            // Admin/agent may create on behalf of a customer
            'customer_id' => ['nullable', 'exists:users,id'],
        ];
    }
}
