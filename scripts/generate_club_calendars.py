#!/usr/bin/env python3
from collections import defaultdict
from datetime import datetime, timezone

from generate_calendars import API, TEAM_OUT, calendar_header, get_json, match_event, write_ics

PREFIX = "all-"


def organisation_name(match, side):
    sponsor = match.get(f"{side}TeamSponsorClubName")
    organisation = match.get(f"{side}Organisation") or {}
    return sponsor or organisation.get("name") or "Basketball vereniging"


def organisation_id(match, side):
    organisation = match.get(f"{side}Organisation") or {}
    for key in ("id", "guid", "organisationId", "organisationGuid"):
        value = organisation.get(key)
        if value:
            return str(value)
    for key in (
        f"{side}OrganisationId",
        f"{side}OrganisationGuid",
        f"{side}ClubId",
        f"{side}ClubGuid",
    ):
        value = match.get(key)
        if value:
            return str(value)
    return ""


def main():
    now = datetime.now(timezone.utc)
    start_year = now.year if now.month >= 7 else now.year - 1
    start_date = f"{start_year}-07-01"
    end_date = f"{start_year + 1}-06-30"
    stamp = now.strftime("%Y%m%dT%H%M%SZ")

    payload = get_json(f"{API}/matches/all")
    source_matches = payload.get("items", []) if isinstance(payload, dict) else payload
    if not isinstance(source_matches, list):
        raise RuntimeError("Unexpected FOYS /matches/all response")

    matches = [
        match
        for match in source_matches
        if start_date <= str(match.get("date") or "")[:10] <= end_date
    ]
    if not matches:
        raise RuntimeError("FOYS returned no current-season matches")

    grouped = defaultdict(dict)
    names = {}
    for match in matches:
        match_id = str(match.get("id"))
        for side in ("home", "away"):
            club_id = organisation_id(match, side)
            if not club_id:
                continue
            grouped[club_id][match_id] = match
            names.setdefault(club_id, organisation_name(match, side))

    for existing in TEAM_OUT.glob(f"{PREFIX}*.ics"):
        existing.unlink()

    for club_id, by_id in grouped.items():
        rows = sorted(
            by_id.values(),
            key=lambda match: (
                str(match.get("date") or ""),
                str(match.get("startTime") or ""),
                int(match.get("id") or 0),
            ),
        )
        lines = calendar_header(f"{names.get(club_id, 'Basketball vereniging')} - alle teams")
        for match in rows:
            lines.extend(match_event(match, stamp))
        write_ics(TEAM_OUT / f"{PREFIX}{club_id}.ics", lines)

    print(f"Generated {len(grouped)} all-team club calendar feeds")
    argon_id = "a4a2e2fa-0635-46a5-8969-1d0fef40444f"
    argon_path = TEAM_OUT / f"{PREFIX}{argon_id}.ics"
    if not argon_path.exists():
        sample = source_matches[0] if source_matches else {}
        raise RuntimeError(
            "SV Argon all-team feed was not generated; FOYS organisation identifier fields may have changed. "
            f"Sample homeOrganisation={sample.get('homeOrganisation')!r}"
        )


if __name__ == "__main__":
    main()
