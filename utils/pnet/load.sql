.mode tabs

.import pnet_annotations.txt annotations
.import survival.txt survival

insert into terms
VALUES ('Survival outcome', 'Survival outcome', null, '{"name": "Survival outcome"}', 0, '', 0);

insert into terms
-- will fill-in the jsondata using setterms.js
select term_id, term_id, 'Survival outcome', '{}', 1, 'survival', 1
from survival
group by term_id;

-- import available terms data 
.import terms.txt terms

insert into terms
select a.term_id, a.term_id, null, '{}', 1, '', 1
from annotations a
where a.term_id not in (select distinct(id) from terms)
group by term_id;
