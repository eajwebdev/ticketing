<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission(\App\Support\Permissions::CLIENTS) ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('user')?->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'.($id ? ",$id" : '')],
            // A client can own several businesses; the first is the primary name.
            // `store_name` alone is still accepted (older clients of this API).
            'business_names' => ['required_without:store_name', 'array', 'min:1', 'max:20'],
            'business_names.*' => ['required', 'string', 'max:255', 'distinct:ignore_case'],
            'store_name' => ['required_without:business_names', 'nullable', 'string', 'max:255'],
            'business_types' => ['nullable', 'array', 'max:20'],
            'business_types.*' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
            'avatar' => ['nullable', 'image', 'max:4096'],
        ];
    }
}
