# Local chart record export

The chart can export an explicit JSON snapshot on the visitor's device. Export does not send a request, create a booking, save to browser storage, or upload a birth record. The user decides where to keep the downloaded file. The existing print action remains the human-readable PDF option.

The snapshot records:

- The optional subject name, local birth date/time, UTC instant, and actual selected place coordinates/timezone/provenance.
- The calculation version and declared engine, zodiac, ayanamsa, node, house, birth-time resolution, and Dasha conventions.
- Numerical planetary placements, ascendant, Panchang, divisional mappings and their explicit conventions, and the available three-level Dasha periods.
- Solar-day/transition results when they are included by the calculator, along with their time and calculation conventions.
- The chosen language, chart style and division as presentation preferences; changing these does not change the numerical record.

The format identifier is `sahni-astrologers-kundali`, schema version `1`. `createChartRecord` explicitly projects known input/calculation fields. `serializeChartRecord` validates and projects the record again before writing UTF-8 JSON. Non-finite numbers, executable/accessor object shapes, unsupported presentation choices, and incomplete mandatory placements are rejected rather than silently converted to JSON `null`. Unrelated booking, contact, provider and session fields are omitted.

This file is an editable numerical snapshot, not a signed certificate, payment record, or proof of professional review. No automatic import is implemented. A future importer must separately validate file size, schema, the source birth data/settings and numerical consistency, and render text safely before using any content.

Downloads are initiated only by an explicit visitor action. `downloadChartRecord(record)` returns `{downloaded:true,filename}` after initiating a top-level browser download. In embedded previews it returns `{downloaded:false,reason:'embedded-viewer'}` without trying to override the viewer's permissions; the interface should ask the visitor to open the downloaded website in a full browser instead. The temporary Blob URL is revoked after initiation. Some browsers can still block or cancel a requested download; the application cannot prove the file was saved to disk.
