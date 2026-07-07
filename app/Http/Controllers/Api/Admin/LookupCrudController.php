<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\LookupResource;
use App\Models\Category;
use App\Models\SystemType;
use App\Models\UrgencyLevel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LookupCrudController extends Controller
{
    private array $map = [
        'system-types' => SystemType::class,
        'categories' => Category::class,
        'urgency-levels' => UrgencyLevel::class,
    ];

    private function modelClass(string $type): string
    {
        abort_unless(isset($this->map[$type]), 404);

        return $this->map[$type];
    }

    private function rules(string $type): array
    {
        $base = [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer'],
        ];

        return match ($type) {
            'system-types' => [...$base, 'icon' => ['nullable', 'string', 'max:100']],
            'urgency-levels' => [
                ...$base,
                'color' => ['nullable', 'string', 'max:20'],
                'sla_hours' => ['nullable', 'integer', 'min:1'],
            ],
            default => $base,
        };
    }

    public function index(string $type)
    {
        $model = $this->modelClass($type);

        return LookupResource::collection($model::orderBy('sort_order')->orderBy('name')->get());
    }

    public function store(Request $request, string $type)
    {
        $model = $this->modelClass($type);
        $data = $request->validate($this->rules($type));

        $item = $model::create($data);

        return new LookupResource($item);
    }

    public function update(Request $request, string $type, int $id)
    {
        $model = $this->modelClass($type);
        $item = $model::findOrFail($id);
        $data = $request->validate($this->rules($type));

        $item->update($data);

        return new LookupResource($item);
    }

    public function destroy(string $type, int $id)
    {
        $model = $this->modelClass($type);
        $item = $model::findOrFail($id);
        $item->delete();

        return response()->noContent();
    }
}
