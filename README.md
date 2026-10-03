# Time Maker

Whole-school timetable builder, planning tools and daily operations.

## Local builder

Use Node 22 or later. Run `npm ci` then `npm run dev`. School data saves in this browser. `npm test` checks scheduling logic; `npm run build` creates `dist/`.

## Staff portal server

Run `npm run build`. For the first server start, set `TIMEMAKER_ADMIN_USER` and `TIMEMAKER_ADMIN_PASSWORD` (at least 12 characters), then run `npm start`. Open http://localhost:3000. Sign in as administrator, load or enter school data, then use Staff Portal to publish the selected timetable and create staff accounts.

The server stores school data and salted scrypt password hashes in `server-data/school.json`. Keep this directory on persistent storage and back it up. It is excluded from Git. Session cookies are HttpOnly, SameSite=Strict, last eight hours, and expire on server restart. Staff responses are scoped to the account's staff record. Staff absence notes and other staff records are not included in portal responses.

For hosting, set `HOST=0.0.0.0`, `PORT` as needed, `NODE_ENV=production`, and `TIMEMAKER_ORIGIN` to the HTTPS site origin. Place the server behind HTTPS; production cookies use Secure. A static-only host runs the browser builder and administrator portal previews; shared sign-in requires this Node server. Development and live school data must use separate storage directories. `DATA_DIR` may be configured by calling `createApp({dataDir})` in your hosting entrypoint.

Publishing snapshots the timetable and resource data. Future draft edits do not alter the published copy. Daily changes and accepted cover plans apply to a date and published timetable, while the master remains unchanged. The Week A reference date is configured on Today.

Student Timetable lets administrators add pupils, assign teaching groups, preview lessons, and create student accounts. Student API responses contain only that pupil's timetable, teacher names, rooms and relevant daily notices. Student accounts cannot read the school dataset or another pupil's timetable. Use Today to publish date-specific changes; students see these after refreshing their portal.

## CSV / Excel exchange

MIS Import / Export accepts CSV and `.xlsx` files with up to 5,000 rows per worksheet and a 10 MB file limit. Download a template, select a sheet, map columns, inspect validation errors and the preview, then apply. Imports update records by stable ID and preserve records not in the file. Import year groups and staff before classes; import classes before pupils and curriculum. Use semicolons for lists. Blank optional columns preserve existing values. Imports change draft school data; the approved timetable stays unchanged until republished.

Export the timetable, staff allocations, rooms, teaching groups, pupil records, subjects and curriculum as CSV or Excel, or create one school workbook with multiple worksheets. A JSON school backup preserves all planner state. Restoring it is a separate explicit action after a preview. Direct vendor MIS API connections are not yet configured.
