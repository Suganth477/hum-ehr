import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMailCount } from '../../services/inAppMailService';
import InAppMailConversationList from './InAppMailConversationList';
import InAppMailThread from './InAppMailThread';
import InAppMailCompose from './InAppMailCompose';
import { FOLDERS } from './inAppMailHelpers';
import './InAppMail.css';

/**
 * In-App Mail surface (legacy in-app-mail-conversation-list.jsp +
 * InAppMailListEachConversationMainElement). Left rail = Compose + folder nav with unread
 * badges from /inAppMail/count; right = a top search bar over the paginated conversation
 * list. Compose and the thread reader arrive in later phases (P4 / P3) — opening either
 * shows a labelled placeholder for now so the list stays fully exercisable.
 *
 * `patientId` scopes the mail to a patient chart (null = the standalone Message Center
 * surface, the current phase's target).
 */
const InAppMail = ({ patientId = null }) => {
    const [folder, setFolder] = useState('INBOX');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sort, setSort] = useState('asc');
    const [openMail, setOpenMail] = useState(null);
    const [composeOpen, setComposeOpen] = useState(false);

    // Debounce the search term (500ms) — the debounced value drives the list query key.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 500);
        return () => clearTimeout(timer);
    }, [search]);

    const { data: countData } = useQuery({
        queryKey: ['inAppMailCount'],
        queryFn: fetchMailCount,
    });
    const counts = useMemo(() => countData?.data || {}, [countData]);

    const selectFolder = (code) => {
        setFolder(code);
        setOpenMail(null);
    };

    return (<div className="iam-container">
      <div className="iam-rail">
        <button type="button" className="iam-compose-btn" title="Compose" onClick={() => setComposeOpen(true)}>
          <svg height="22" viewBox="0 -960 960 960" width="22" fill="#fff">
            <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z" />
          </svg>
          <b>Compose</b>
        </button>
        <ul className="iam-folder-list">
          {FOLDERS.map((f) => {
            const badge = f.countKey ? counts[f.countKey] : 0;
            return (
              <li key={f.code} className={`iam-folder ${folder === f.code ? 'active' : ''}`}>
                <button type="button" onClick={() => selectFolder(f.code)}>
                  <svg width="22" height="22" viewBox={f.viewBox} className="iam-folder-icon"><path d={f.path} /></svg>
                  <span className="iam-folder-label">{f.label}</span>
                  {!!badge && <span className="iam-folder-count">{badge}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="iam-main">
        {openMail ? (
          <InAppMailThread
            parentMailId={openMail.parentMailId}
            siblings={openMail.siblings}
            recordsTotal={openMail.recordsTotal}
            folder={folder}
            patientId={patientId}
            onBack={() => setOpenMail(null)} />
        ) : (
          <>
            <div className="iam-search-bar">
              <span className="iam-search-icon-wrap">
                <svg className="iam-search-icon" height="22" viewBox="0 -960 960 960" width="22" fill="#5f6368">
                  <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z" />
                </svg>
              </span>
              <input type="text" className="form-control iam-search-input" placeholder="Search by name"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <InAppMailConversationList
              folder={folder}
              search={debouncedSearch}
              sort={sort}
              onSortChange={setSort}
              patientId={patientId}
              onOpenMail={setOpenMail} />
          </>
        )}
      </div>

      {composeOpen && (
        <div className="iam-compose-overlay">
          <InAppMailCompose
            variant="panel"
            sendType="ORGINL"
            patientId={patientId}
            onDone={() => setComposeOpen(false)}
            onClose={() => setComposeOpen(false)} />
        </div>
      )}
    </div>);
};
export default InAppMail;
