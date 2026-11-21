# Screenshots

Put the screenshots here as **PNG** files, exactly as captured; they are never modified. The book picks them up
automatically by name; until a file exists, the book shows a framed "Screenshot to be added" placeholder.

| File | Shows | Used in |
|---|---|---|
| `mobile_home.png` | Citizen home screen with the SOS button | Appendix C |
| `mobile_report.png` | Emergency report (category, location, message, guidance) *(long)* | Chapter 5 |
| `mobile_tracking_and_chat.png` | Live tracking of the response, incident details and chat *(long)* | Chapter 5 |
| `mobile_mission.png` | A mission offered to an ambulance crew *(long)* | Appendix C |
| `mobile_handoff.png` | Ambulance handoff on arrival: patient information, destination hospital *(long)* | Chapter 5 |
| `mobile_handoff2.png` | Ambulance handoff while transporting: vitals entry and latest vitals *(long)* | Appendix C |
| `mobile_medical.png` | Medical profile with the sharing consent switch *(long)* | Appendix C |
| `mobile_kyc.png` | Account screen with identity verification | Appendix C |
| `web_dispatch.png` | Dispatcher workspace: live queue, map, unit panel | Chapter 5 |
| `web_hospital.png` | Hospital dashboard: incoming transfers and vitals | Appendix C |
| `web_admin.png` | Administration: users, facilities, units | Appendix C |

## Long (scrolling) screenshots

A full-length capture of a scrolling phone screen is several times taller than a page (a 1080 x 7304 px capture
would be only about 3.6 cm wide on a page, with unreadable text). The book therefore shows it as **consecutive
panels side by side**, read left to right. The image file is used as it is: LaTeX clips each panel out of it when the
book is compiled, so there are no extra image files to keep in step.

```latex
\scrollshot[0.3048,0.6005]{mobile_tracking_and_chat}{Caption.}{fig:label}
%           ^ where to cut, as fractions of the height: two cuts = three panels
```

If you retake a long screenshot, or want different cut points, run

```bash
python3 tools/suggest_cuts.py mobile_report 2     # needs: pip install pillow numpy
```

which prints a ready-to-paste `\scrollshot` line with cut positions that fall in gaps of the screen (so no card or
button is sliced in half). Short screens (home, account) and desktop screenshots use `\screenshot` and
`\screenshotpair` and are placed whole.

## Tips

Use the production build with realistic (non-personal) demo data; hide any real e-mail, phone number or token.
Capture phones at their native resolution (about 1080 px wide) and desktop screens at 1920 px wide.
Run `make placeholders` to see which files are still missing.
