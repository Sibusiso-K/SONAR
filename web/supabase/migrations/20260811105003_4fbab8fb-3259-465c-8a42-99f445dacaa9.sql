
CREATE TABLE public.opportunities (
  id text PRIMARY KEY,
  name text NOT NULL,
  organiser text NOT NULL,
  kind text NOT NULL,
  format text NOT NULL DEFAULT 'online',
  scope text NOT NULL DEFAULT 'national',
  tier smallint NOT NULL DEFAULT 3,
  score numeric NOT NULL DEFAULT 0,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  dates jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_date date,
  confidence text NOT NULL DEFAULT 'unconfirmed',
  prize jsonb NOT NULL DEFAULT '{}'::jsonb,
  career_track text NOT NULL DEFAULT 'none',
  eligibility text,
  what_to_build text,
  deliverables text,
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  source text,
  went_live_on date,
  noticed_on date,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO anon, authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opportunities open" ON public.opportunities FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.past_opportunities (
  id text PRIMARY KEY,
  name text NOT NULL,
  organiser text NOT NULL,
  kind text NOT NULL,
  happened_on date,
  outcome text NOT NULL DEFAULT 'missed',
  placement text,
  note text,
  corrected boolean NOT NULL DEFAULT false,
  correction_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.past_opportunities TO anon, authenticated;
GRANT ALL ON public.past_opportunities TO service_role;
ALTER TABLE public.past_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "past open" ON public.past_opportunities FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id text,
  actor text NOT NULL DEFAULT 'pipeline',
  actor_kind text NOT NULL DEFAULT 'automated',
  change_kind text NOT NULL DEFAULT 'note',
  summary text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.updates TO anon, authenticated;
GRANT ALL ON public.updates TO service_role;
ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "updates readable" ON public.updates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "updates appendable" ON public.updates FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id text NOT NULL,
  watched_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, watched_by)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO anon, authenticated;
GRANT ALL ON public.watchlist TO service_role;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist open" ON public.watchlist FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.opportunities (id,name,organiser,kind,format,scope,tier,score,scores,dates,next_date,confidence,prize,career_track,eligibility,what_to_build,deliverables,links,notes,source,went_live_on,noticed_on) VALUES
('bcg-platinion','BCG Platinion Tech Challenge','Boston Consulting Group','competition','hybrid','continental',1,88,'{"career_leverage":95,"winnability":55,"prize":60,"urgency":90}','{"opens":"2026-08-01","deadline":"2026-10-14","event":"2026-10-16"}','2026-10-14','confirmed','{"currency":"USD","pool":15000,"breakdown":"$10k winner, $3k runner-up, $2k third + interview fast-track"}','direct','Penultimate or final-year students, any engineering or CS discipline. Africa & Middle East region.','A tech-strategy case response plus a working prototype for the assigned client brief.','Slide deck (max 10), prototype repo, 5-min recorded walkthrough','{"brief":"https://careers.bcg.com/platinion","register":"https://careers.bcg.com/platinion/apply"}','Interview fast-track is worth more than the cash. Roughly 900 teams last cycle, ~4,000 applicants. Clashes with IBM Z Datathon in mid-October.','BCG careers page','2026-07-28','2026-08-02'),
('ibm-z-datathon','IBM Z Datathon','IBM','hackathon','online','global',1,82,'{"career_leverage":80,"winnability":48,"prize":70,"urgency":88}','{"opens":"2026-08-15","deadline":"2026-10-12","event":"2026-10-17"}','2026-10-12','confirmed','{"currency":"USD","pool":25000,"breakdown":"$12k grand prize, category prizes $3k each"}','direct','Open to students and early-career developers worldwide. Teams of 2-5.','Data product on the provided mainframe-adjacent dataset; judged on insight quality and deployment realism.','Repo, hosted demo, 3-min video, written insight memo','{"brief":"https://ibm.com/z-datathon"}','10,000+ participants expected globally. Winnability is genuinely low but category prizes are less contested. Overlaps BCG Platinion weekend.','IBM developer newsletter','2026-08-03','2026-08-05'),
('entelect-university-cup','Entelect University Cup','Entelect','competition','in-person','national',1,84,'{"career_leverage":88,"winnability":70,"prize":55,"urgency":72}','{"opens":"2026-07-20","deadline":"2026-09-05","event":"2026-09-19"}','2026-09-05','confirmed','{"currency":"ZAR","pool":180000,"breakdown":"R100k winning team, R50k runner-up, R30k third"}','direct','Registered South African university students. Teams of 4.','Bot-battle engine strategy — last year was a resource-collection grid game.','Bot submission, strategy writeup','{"brief":"https://entelect.co.za/university-cup"}','We only caught this in time by luck last cycle — a friend mentioned it. Field is ~120 teams, which is the best odds on the board. Application submitted, awaiting confirmation.','Word of mouth','2026-07-20','2026-08-01'),
('discovery-gradhack','Discovery Gradhack 2027','Discovery','hackathon','hybrid','national',1,79,'{"career_leverage":92,"winnability":62,"prize":48,"urgency":40}','{"opens":"2026-11-01","deadline":"2027-01-30","event":"2027-02-20"}','2027-01-30','reported','{"currency":"ZAR","pool":150000,"breakdown":"R90k winners + graduate programme fast-track"}','direct','Final-year and honours students, South Africa.','Health-behaviour product built on the Vitality data model.','Prototype, pitch deck, 10-min live pitch','{"brief":"https://discovery.co.za/gradhack"}','We almost missed this entirely last year — nothing was monitoring the careers page and we found out 9 days before close. Now watched weekly. Placed Top 6 in the 2026 edition.','Discovery careers page','2026-10-25','2026-11-04'),
('mintek-innovation','Mintek Digital Innovation Challenge','Mintek','competition','in-person','national',2,66,'{"career_leverage":70,"winnability":66,"prize":42,"urgency":78}','{"opens":"2026-06-15","deadline":"2026-09-26","event":"2026-10-24"}','2026-09-26','confirmed','{"currency":"ZAR","pool":90000,"breakdown":"R50k first, R25k second, R15k third"}','adjacent','South African students in STEM disciplines.','Digital tooling for mineral-processing operations. Domain-heavy, low competition.','Prototype, technical report','{"brief":"https://mintek.co.za/innovation-challenge"}','Small field, roughly 40 entries historically. Application submitted 2026-08-04, no acknowledgement yet.','Mintek newsroom','2026-06-15','2026-06-22'),
('standard-bank-graduate','Standard Bank Engineering Graduate Programme','Standard Bank','grad-programme','in-person','national',2,71,'{"career_leverage":90,"winnability":50,"prize":20,"urgency":85}','{"opens":"2026-07-01","deadline":"2026-08-29"}','2026-08-29','confirmed','{"currency":"ZAR","pool":0,"breakdown":"No prize — salaried graduate placement"}','direct','Final-year BSc/BEng, minimum 65% average.','Online assessment, then technical interview.','CV, transcript, online assessment','{"apply":"https://standardbank.co.za/graduate"}','No prize pool, so expected-value ranking will bury it. That is a known blind spot in the EV model — career leverage carries this one.','Grad portal RSS','2026-07-01','2026-07-02'),
('nasa-space-apps','NASA Space Apps Challenge','NASA','hackathon','hybrid','global',3,54,'{"career_leverage":45,"winnability":30,"prize":25,"urgency":66}','{"opens":"2026-08-01","deadline":"2026-09-28","event":"2026-10-03"}','2026-09-28','confirmed','{"currency":"USD","pool":0,"breakdown":"No cash — global nomination and NASA visit for winners"}','adjacent','Open to everyone.','Open-ended challenge from the published brief list.','Repo, 30-second video, project page','{"brief":"https://spaceappschallenge.org"}','Fun, high visibility, essentially unwinnable at global level — 90,000+ participants. Local-node recognition is realistic.','Space Apps mailing list','2026-07-30','2026-07-31'),
('deloitte-analytics','Deloitte Analytics Challenge','Deloitte','competition','online','continental',2,63,'{"career_leverage":75,"winnability":58,"prize":38,"urgency":30}','{"opens":"2026-09-15","deadline":"2026-11-20"}','2026-11-20','reported','{"currency":"USD","pool":8000,"breakdown":"Reported $8k pool, unconfirmed split"}','direct','Students and graduates within 2 years of completion.','Analytics case on an anonymised client dataset.','Notebook, executive summary','{}','Dates reported on a partner university page, not on the Deloitte site itself. Do not treat as calendar-safe until confirmed.','University careers board','2026-09-10',NULL),
('kaggle-arc-prize','ARC Prize 2026','ARC Prize Foundation','competition','online','global',1,58,'{"career_leverage":50,"winnability":12,"prize":100,"urgency":50}','{"opens":"2026-03-01","deadline":"2026-11-03"}','2026-11-03','confirmed','{"currency":"USD","pool":700000,"breakdown":"$700k total, $600k grand prize contingent on 85% threshold"}','adjacent','Open worldwide.','A program-synthesis solver for the ARC-AGI-2 benchmark.','Kaggle notebook submission, paper for paper awards','{"brief":"https://arcprize.org"}','Enormous pool, near-zero odds — this is the entry that proves why raw prize size is a bad ranking signal. Paper award track is the only realistic angle.','Kaggle competitions feed','2026-03-01','2026-03-04'),
('absa-cybersecurity','Absa Cybersecurity Challenge','Absa','competition','online','national',3,44,'{"career_leverage":55,"winnability":45,"prize":30,"urgency":20}','{"expected_window":"2027-02 to 2027-04"}',NULL,'predicted','{"currency":"ZAR","pool":60000,"breakdown":"Estimated from 2025 edition"}','adjacent','Assumed South African students.','CTF-style, based on previous editions.',NULL,'{}','Predicted from a two-year pattern. No 2027 announcement exists yet. Do not put this in a calendar.','Pattern inference',NULL,NULL),
('takealot-hack','Takealot Engineering Hack','Takealot','hackathon','in-person','national',2,57,'{"career_leverage":68,"winnability":60,"prize":35,"urgency":25}','{"expected_window":"2027-03"}',NULL,'unconfirmed','{"currency":"ZAR","pool":75000,"breakdown":"Unverified"}','direct','Unknown.','Unknown — previous editions were logistics-optimisation themed.',NULL,'{}','Two conflicting sources on whether the 2026 edition ran at all. Sitting on unconfirmed since 2026-05-11, which is far too long.','LinkedIn monitoring','2026-05-05',NULL),
('sasol-solve','Sasol Solve','Sasol','competition','hybrid','national',3,41,'{"career_leverage":48,"winnability":52,"prize":28,"urgency":15}','{"expected_window":"2027-05"}',NULL,'conflicted','{"currency":"ZAR","pool":50000,"breakdown":"Two sources disagree: R50k vs R120k"}','none','Conflicting eligibility statements between the 2025 and 2026 pages.','Energy-transition data project.',NULL,'{}','Flagged conflicted deliberately. We would rather show a contradiction than pick the flattering number.','Sasol media page','2026-04-18',NULL);

INSERT INTO public.past_opportunities (id,name,organiser,kind,happened_on,outcome,placement,note,corrected,correction_note) VALUES
('gradhack-2026','Discovery Gradhack 2026','Discovery','hackathon','2026-02-21','placed','Top 6','Entered with 9 days notice after nearly missing the announcement entirely.',true,'Originally logged as "missed" on 2026-02-25 because nobody updated the board after the event. Corrected on 2026-03-11 once the results page confirmed a Top 6 placement. The board was wrong for 15 days.'),
('nedbank-hack-2026','Nedbank Fintech Hack','Nedbank','hackathon','2026-04-11','missed','','Deadline passed while both of us were in exams. No monitoring failure — a scheduling one.',false,NULL),
('cape-ai-summit','Cape AI Summit Hack','Cape AI','hackathon','2026-05-30','entered','Did not place','Submitted a half-finished prototype. Honest read: we started 30 hours out.',false,NULL),
('sa-data-olympiad','SA Data Olympiad','StatsSA','competition','2026-06-14','won','1st','Small field (18 teams). A win is a win, but the field size matters more than the trophy.',false,NULL),
('shoprite-graduate','Shoprite Graduate Programme','Shoprite','grad-programme','2026-03-30','rejected','','Rejected at online-assessment stage. Numerical reasoning section, both of us.',false,NULL),
('bosch-mobility','Bosch Mobility Challenge','Bosch','competition','2026-01-18','missed','','Discovered 4 days after the deadline. Source was not monitored at all at the time.',false,NULL);

INSERT INTO public.updates (opportunity_id,actor,actor_kind,change_kind,summary,detail,created_at) VALUES
('gradhack-2026','Sibusiso','human','correction','Corrected Gradhack 2026 outcome from "missed" to Top 6 placement','Results page confirmed the placement. The board carried a wrong outcome for 15 days because nobody updated it post-event.','2026-03-11 09:14+02'),
('bcg-platinion','verification pipeline','automated','confidence','BCG Platinion moved unconfirmed to confirmed','Deadline 2026-10-14 read directly from the official brief PDF.','2026-08-02 06:02+02'),
('ibm-z-datathon','verification pipeline','automated','discovery','IBM Z Datathon added to the board','Picked up from the IBM developer newsletter, 2 days after it went live.','2026-08-05 06:01+02'),
('bcg-platinion','verification pipeline','automated','conflict','Deadline collision detected: BCG Platinion and IBM Z Datathon','Both fall in the week of 2026-10-12. Two committed entries, one weekend.','2026-08-05 06:03+02'),
('entelect-university-cup','Lethabo','human','status','Entelect University Cup application submitted','Team of 4 registered. Awaiting confirmation email.','2026-08-01 17:40+02'),
('mintek-innovation','Sibusiso','human','status','Mintek application submitted','No acknowledgement received yet. Chase on 2026-08-18 if still silent.','2026-08-04 11:22+02'),
('takealot-hack','verification pipeline','automated','stale','Takealot Engineering Hack has been unconfirmed for 92 days','Two sources still disagree on whether the 2026 edition ran. Recommend demoting to predicted or removing.','2026-08-10 06:04+02'),
('sasol-solve','verification pipeline','automated','conflict','Sasol Solve prize pool marked conflicted','R50k on the 2026 media page, R120k on a partner listing. Neither is authoritative.','2026-07-19 06:02+02'),
('discovery-gradhack','Lethabo','human','note','Discovery Gradhack 2027 window reported, not confirmed','Careers page still shows 2026 content. Weekly monitor now active on this URL after last year.','2026-07-14 20:05+02'),
('kaggle-arc-prize','verification pipeline','automated','score','ARC Prize winnability lowered to 12','Leaderboard analysis: top score still well below the grand-prize threshold with 3 months left.','2026-08-08 06:02+02');

INSERT INTO public.watchlist (opportunity_id,watched_by) VALUES
('bcg-platinion','Sibusiso'),
('bcg-platinion','Lethabo'),
('entelect-university-cup','Lethabo'),
('discovery-gradhack','Sibusiso'),
('ibm-z-datathon','Sibusiso');
