<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/svg+xml" href="/eaj-favicon.svg">
    <meta name="google-client-id" content="{{ config('services.google.client_id') }}">
    <title>EAJ Support — Advanced Ticketing</title>
    @viteReactRefresh
    @vite(['resources/js/main.jsx'])
</head>
<body>
    <div id="root"></div>
</body>
</html>
