# Open Finances Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NUMERA FINANCE APP                            │
└─────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│                         ADMIN INTERFACE                                │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    Settings Page                              │    │
│  │  ┌────────────────────────────────────────────────────────┐  │    │
│  │  │        Open Finances Settings Card                     │  │    │
│  │  │                                                         │  │    │
│  │  │  [x] Enable Open Finances                             │  │    │
│  │  │                                                         │  │    │
│  │  │  Page Title: [ Financial Transparency           ]     │  │    │
│  │  │  Description: [ We believe in open finances... ]     │  │    │
│  │  │                                                         │  │    │
│  │  │  Select Metrics to Expose:                            │  │    │
│  │  │  ┌─────────────────────────────────────────────┐     │  │    │
│  │  │  │ [x] Revenue    [$100,000            ]       │     │  │    │
│  │  │  │ [x] Expenses   [$60,000             ]       │     │  │    │
│  │  │  │ [x] Profit     [$40,000             ]       │     │  │    │
│  │  │  │ [ ] Balance    [                     ]       │     │  │    │
│  │  │  └─────────────────────────────────────────────┘     │  │    │
│  │  │                                                         │  │    │
│  │  │  [x] Allow Embedding                                  │  │    │
│  │  │                                                         │  │    │
│  │  │  Public URL:                                          │  │    │
│  │  │  [https://app.com/open-finances/user123  ] [Copy]   │  │    │
│  │  │                                                         │  │    │
│  │  │  Embed Code:                                          │  │    │
│  │  │  [<iframe src="..." ...>               ] [Copy]      │  │    │
│  │  └────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ PATCH /api/open-finances
                                    │ (Authenticated)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  open_finances_settings                                     │    │
│  │  ─────────────────────────────────────────────────────────  │    │
│  │  user_id: "user123"                                         │    │
│  │  is_enabled: true                                           │    │
│  │  exposed_metrics: {                                         │    │
│  │    "revenue": {"enabled": true, "value": "$100,000"},       │    │
│  │    "expenses": {"enabled": true, "value": "$60,000"},       │    │
│  │    "profit": {"enabled": true, "value": "$40,000"}          │    │
│  │  }                                                           │    │
│  │  page_title: "Financial Transparency"                       │    │
│  │  allow_embedding: true                                      │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ GET /api/open-finances/public/:userId
                                    │ (No Authentication Required)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PUBLIC PAGE                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    Financial Transparency                   │    │
│  │                We believe in open finances...               │    │
│  │                                                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │    │
│  │  │   REVENUE    │  │   EXPENSES   │  │    PROFIT    │    │    │
│  │  │   $100,000   │  │   $60,000    │  │   $40,000    │    │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │    │
│  │                                                              │    │
│  │       Powered by Numera - Financial Transparency            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  URL: https://app.com/open-finances/user123                        │
│  Embeddable: Yes (with configurable CSP)                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Can be embedded via iframe
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  EXTERNAL WEBSITE                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  Company Homepage                           │    │
│  │                                                              │    │
│  │  Our Mission | About Us | Contact                          │    │
│  │                                                              │    │
│  │  ┌────────────────────────────────────────────────────┐   │    │
│  │  │ <iframe src="https://app.com/open-finances/...">  │   │    │
│  │  │   [Financial Transparency Page Embedded Here]      │   │    │
│  │  │                                                     │   │    │
│  │  │   REVENUE    EXPENSES    PROFIT                    │   │    │
│  │  │   $100,000   $60,000     $40,000                   │   │    │
│  │  │                                                     │   │    │
│  │  └────────────────────────────────────────────────────┘   │    │
│  │                                                              │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       SECURITY LAYERS                                │
│                                                                       │
│  ✓ Authentication for admin endpoints                               │
│  ✓ Rate limiting on all API endpoints                              │
│  ✓ Data filtering - only enabled metrics returned                  │
│  ✓ No automatic data aggregation                                    │
│  ✓ Configurable CSP frame-ancestors                                │
│  ✓ Environment-based origin restrictions                           │
│  ✓ No sensitive data exposure                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW                                     │
│                                                                       │
│  Admin → Settings UI → API (Auth) → Database → API (Public) → Page │
│                                                      ↓                │
│                                               External Embed         │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Features

1. **Admin Control**: Full control over what data is exposed
2. **Real-time Updates**: Changes are immediate, no redeployment
3. **Embeddable**: Can be embedded on any website with configurable restrictions
4. **Secure**: Multiple security layers protect sensitive data
5. **Flexible**: Custom values, titles, and descriptions
6. **Private by Default**: Only explicitly enabled data is shown

## Update Flow

```
User enables metric in Settings
          ↓
API validates and saves to database
          ↓
Public endpoint immediately reflects changes
          ↓
Embedded pages show updated data
```

## Security Model

```
┌────────────────────┐
│  Admin Endpoints   │ ← Requires Authentication
└────────────────────┘
         │
         ↓
┌────────────────────┐
│    Database        │ ← Stores all configuration
└────────────────────┘
         │
         ↓
┌────────────────────┐
│  Public Endpoint   │ ← Filters to only enabled data
└────────────────────┘
         │
         ↓
┌────────────────────┐
│   Public Page      │ ← Shows only exposed metrics
└────────────────────┘
```
