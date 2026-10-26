-- Store listing and its resolved icon are kept with the project so cards load quickly.
alter table public.projects
  add column store_url text check (store_url is null or (
    length(store_url) <= 2048 and store_url ~ '^https://(play[.]google[.]com/store/apps/details[?]id=[A-Za-z][A-Za-z0-9_.]{2,199}|apps[.]apple[.]com/.*/id[0-9]{5,20})$'
  )),
  add column app_icon_url text check (app_icon_url is null or (
    length(app_icon_url) <= 2048 and app_icon_url ~ '^https://(play-lh[.]googleusercontent[.]com/|is[0-9]+-ssl[.]mzstatic[.]com/)'
  ));
