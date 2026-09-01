#!/usr/bin/env python3
import json
import re
import unicodedata
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

FEDERATION_ID = "52cfa65e-9782-4a81-ab35-e2f981fcb7a9"
API = "https://api.foys.io/competition/public-api/v1"
USER_AGENT = "Basketball-Agenda-GitHub-Pages/1.0"
OUT = Path("cal")
TEAM_OUT = OUT / "teams"
TASK_OUT = OUT / "tasks"


def get_json(url):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "X-FederationID": FEDERATION_ID,
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def esc(value):
    return (
        str(value or "")
        .replace("\\", "\\\\")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace(",", "\\,")
        .replace(";", "\\;")
    )


def slug(value):
    value = unicodedata.normalize("NFD", str(value or "").lower())
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-") or "all"


def compact_date(value):
    return str(value or "")[:10].replace("-", "")


def compact_time(value):
    raw = str(value or "00:00")[:5].replace(":", "")
    return f"{raw}00"


def organisation_name(match, side):
    sponsor = match.get(f"{side}TeamSponsorClubName")
    organisation = (match.get(f"{side}Organisation") or {}).get("name")
    return sponsor or organisation or ""


def full_team_name(match, side):
    return " ".join(
        filter(None, [organisation_name(match, side), match.get(f"{side}TeamName")])
    ).strip() or "Onbekend team"


def location(match):
    address = match.get("address") or {}
    street = " ".join(
        filter(
            None,
            [
                address.get("address1"),
                str(address.get("houseNumber") or ""),
                address.get("houseNumberExtension"),
            ],
        )
    ).strip()
    city = " ".join(filter(None, [address.get("zipCode"), address.get("city")])).strip()
    return ", ".join(filter(None, [match.get("accommodationName"), street, city]))


def has_score(match):
    return match.get("homeScore") is not None and match.get("awayScore") is not None


def game_summary(match):
    home = full_team_name(match, "home")
    away = full_team_name(match, "away")
    if match.get("status") == "Cancelled":
        return f"AFGELAST: {home} - {away}"
    if has_score(match):
        return f"{home} {match.get('homeScore')} - {match.get('awayScore')} {away}"
    return f"{home} - {away}"


def game_description(match):
    parts = []
    competition = (match.get("competition") or {}).get("name")
    if competition:
        parts.append(competition)
    if match.get("status"):
        parts.append(f"Status: {match.get('status')}")
    if has_score(match):
        parts.append(f"Uitslag: {match.get('homeScore')} - {match.get('awayScore')}")
    parts.append(f"FOYS wedstrijd-ID: {match.get('id')}")
    return "\n".join(parts)


def calendar_header(name):
    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Basketball Agenda//NL",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{esc(name)}",
        "X-WR-TIMEZONE:Europe/Amsterdam",
        "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
        "X-PUBLISHED-TTL:PT12H",
    ]


def match_event(match, stamp):
    event = [
        "BEGIN:VEVENT",
        f"UID:foys-match-{match.get('id')}@basketball-agenda",
        f"DTSTAMP:{stamp}",
        f"LAST-MODIFIED:{stamp}",
        f"DTSTART;TZID=Europe/Amsterdam:{compact_date(match.get('date'))}T{compact_time(match.get('startTime'))}",
        "DURATION:PT2H",
        f"SUMMARY:{esc(game_summary(match))}",
        f"DESCRIPTION:{esc(game_description(match))}",
        f"LOCATION:{esc(location(match))}",
    ]
    event.append("STATUS:CANCELLED" if match.get("status") == "Cancelled" else "STATUS:CONFIRMED")
    event.append("END:VEVENT")
    return event


def write_ics(path, lines):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(("\r\n".join(lines + ["END:VCALENDAR", ""])).encode("utf-8"))


def task_event(task, stamp, person=None):
    roles = []
    if person:
        if person in task.get("referees", []):
            roles.append("Scheidsrechter")
        if person in task.get("table", []):
            roles.append("Tafel")
    if person:
        summary = f"{' + '.join(roles) or 'Taak'}: {task.get('home')} - {task.get('away')}"
        role_text = f"Jouw taak: {' + '.join(roles) or 'Taak'}"
    else:
        summary = f"Taak: {task.get('home')} - {task.get('away')}"
        refs = ", ".join(dict.fromkeys(task.get("referees", [])))
        table = ", ".join(dict.fromkeys(task.get("table", [])))
        role_text = f"Scheidsrechters: {refs}\nTafel: {table}"
    person_key = slug(person) if person else "all"
    return [
        "BEGIN:VEVENT",
        f"UID:argon-{task.get('id')}-{person_key}@basketball-agenda",
        f"DTSTAMP:{stamp}",
        f"LAST-MODIFIED:{stamp}",
        f"DTSTART;TZID=Europe/Amsterdam:{compact_date(task.get('date'))}T{compact_time(task.get('arrivalTime'))}",
        "DURATION:PT2H30M",
        f"SUMMARY:{esc(summary)}",
        f"DESCRIPTION:{esc('Wedstrijd ' + str(task.get('startTime') or '') + chr(10) + role_text)}",
        f"LOCATION:{esc(', '.join(filter(None, [task.get('location'), task.get('field')])))}",
        "STATUS:CONFIRMED",
        "END:VEVENT",
    ]


def main():
    TEAM_OUT.mkdir(parents=True, exist_ok=True)
    TASK_OUT.mkdir(parents=True, exist_ok=True)

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
    print(f"FOYS /matches/all returned {len(source_matches)} rows; {len(matches)} are in season {start_year}-{start_year + 1}")
    if not matches:
        raise RuntimeError("FOYS returned no current-season matches; refusing to publish empty feeds")

    grouped = defaultdict(dict)
    team_names = {}
    for match in matches:
        match_id = str(match.get("id"))
        for side in ("home", "away"):
            guid = match.get(f"{side}TeamGuid")
            if not guid:
                continue
            grouped[guid][match_id] = match
            team_names.setdefault(guid, full_team_name(match, side))

    for existing in TEAM_OUT.glob("*.ics"):
        existing.unlink()

    for guid, by_id in grouped.items():
        rows = sorted(
            by_id.values(),
            key=lambda m: (
                str(m.get("date") or ""),
                str(m.get("startTime") or ""),
                int(m.get("id") or 0),
            ),
        )
        lines = calendar_header(team_names.get(guid, "Basketball wedstrijden"))
        for match in rows:
            lines.extend(match_event(match, stamp))
        write_ics(TEAM_OUT / f"{guid}.ics", lines)

    task_data = json.loads(Path("data/tasks.json").read_text(encoding="utf-8"))
    tasks = task_data.get("tasks", [])
    people = sorted(
        {
            person
            for task in tasks
            for person in (task.get("referees", []) + task.get("table", []))
            if person
        },
        key=str.casefold,
    )

    for existing in TASK_OUT.glob("*.ics"):
        existing.unlink()

    all_lines = calendar_header("Basketball taken - alle personen")
    for task in sorted(tasks, key=lambda t: (t.get("date", ""), t.get("arrivalTime", ""))):
        all_lines.extend(task_event(task, stamp))
    write_ics(TASK_OUT / "all.ics", all_lines)

    for person in people:
        person_lines = calendar_header(f"Basketball taken - {person}")
        for task in sorted(tasks, key=lambda t: (t.get("date", ""), t.get("arrivalTime", ""))):
            if person in task.get("referees", []) or person in task.get("table", []):
                person_lines.extend(task_event(task, stamp, person))
        write_ics(TASK_OUT / f"{slug(person)}.ics", person_lines)

    metadata = {
        "generatedAt": now.isoformat(),
        "season": f"{start_year}-{start_year + 1}",
        "federationId": FEDERATION_ID,
        "sourceMatchCount": len(source_matches),
        "matchCount": len(matches),
        "teamFeedCount": len(grouped),
        "taskFeedCount": len(people) + 1,
    }
    (OUT / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
