<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\LookupResource;
use App\Models\Category;
use App\Models\SystemType;
use App\Models\UrgencyLevel;

class LookupController extends Controller
{
    public function all()
    {
        return response()->json([
            'system_types' => LookupResource::collection(SystemType::active()->get()),
            'categories' => LookupResource::collection(Category::active()->get()),
            'urgency_levels' => LookupResource::collection(UrgencyLevel::active()->get()),
        ]);
    }

    public function systemTypes()
    {
        return LookupResource::collection(SystemType::active()->get());
    }

    public function categories()
    {
        return LookupResource::collection(Category::active()->get());
    }

    public function urgencyLevels()
    {
        return LookupResource::collection(UrgencyLevel::active()->get());
    }
}
