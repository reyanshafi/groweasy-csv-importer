# Sample CSVs

Each file exercises a different real-world export shape. Expected results assume the default config.

| File | Style | Rows | What it demonstrates |
| --- | --- | --- | --- |
| `facebook-leads-export.csv` | Facebook Lead Ads export | 5 | ALL-CAPS names, `+91`/bare/trunk-zero phones, multiple emails+phones in one cell, campaign → `data_source` fuzzy match. 1 junk row skipped. |
| `google-ads-lead-form.csv` | Google Ads lead form | 6 | `USER_*` column names, GCLID/Lead ID columns (ignored by the mapping plan), phone split into code+number, `Region` split into state+country. 1 contact-less row skipped. |
| `real-estate-crm-export.csv` | Another CRM's export | 6 | Fuzzy statuses ("Ringing no response" → `DID_NOT_CONNECT`, "Deal Closed!!" → `SALE_DONE`), DD/MM dates, landline+mobile pairs, quoted line breaks, invalid email preserved in notes. 1 walk-in without contact skipped. |
| `sales-team-report.csv` | International sales report | 6 | +1/+971/+44/+65 country codes, US-style MM/DD dates, deal stages → CRM statuses. 1 spam row skipped. |
| `manual-clean-leads.csv` | Hand-made spreadsheet | 8 | The happy path: every row has valid contact info — **8/8 imported, zero skips**; project names map to `data_source` values. |
| `bulk-leads-150.csv` | Generated messy bulk file | 150 | Multi-batch AI processing with live progress; mixed date/phone formats; a few contact-less rows skipped with reasons. |
| `groweasy-crm-format.csv` | Already in CRM format | 4 | **Passthrough**: detected as CRM-shaped → validated instantly with zero AI calls. |
| `crm-bulk-1500.csv` | CRM format, bulk | 1500 | Passthrough at scale (~50 ms) + virtualized results table; 15 contact-less rows still skipped by validation. |
