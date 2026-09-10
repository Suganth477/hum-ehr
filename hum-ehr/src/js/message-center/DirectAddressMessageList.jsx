import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
    DIRECT_SECTIONS, DIRECT_PAGE_SIZE, fetchDirectMessageList, fetchDirectMessageSectionCounts,
} from '../../services/directAddressService';
import { useNotify } from '../../context/NotificationContext';
import { useOpenPatientChart } from '../../hooks/useOpenPatientChart';
import { SkeletonList } from '../../components/common/ContentLoader';
import { LegacyIcon } from '../../components/common/CustomIcons';
import DirectAddressConversation from './DirectAddressConversation';
import DirectAddressCompose from './DirectAddressCompose';
import {
    fromToSectionContent, subjectAndPreview, formatMessageListDate, sectionTitleCase,
    DRAFT_STATUS, ERROR_STATUS_CODES,
} from './directAddressHelpers';

/**
 * Per-section count badges on the tabs. The legacy list element ships the count
 * call but leaves it commented out at the call site, so the badges are off here
 * too — flip this to true once /direct/message/count is confirmed on the server.
 */
const SHOW_SECTION_COUNTS = false;

/**
 * Direct Address message list (legacy EhrDirectAdressMessagesList).
 *
 * Inbound / Outbound / Draft / Archived tabs over one mailbox, with a debounced
 * search, a Compose button and 10-per-page server-side paging. Opening a row shows
 * either the conversation reader or — for a standalone draft — the composer; both
 * take over the panel and swap the tab strip for a "Back to <section>" link, exactly
 * as the legacy surface does.
 */
const DirectAddressMessageList = ({ directAddress, onDetailOpenChange }) => {
    const { notifyError } = useNotify();
    const queryClient = useQueryClient();
    const openPatientChart = useOpenPatientChart();
    const [sectionType, setSectionType] = useState('INBOUND');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [start, setStart] = useState(0);
    // { mode: 'conversation' | 'compose', … } — null while the list is showing.
    const [detail, setDetail] = useState(null);

    const directAddressId = directAddress?.directAddressId;
    const section = DIRECT_SECTIONS.find((s) => s.type === sectionType) || DIRECT_SECTIONS[0];

    // Debounce the search term (500ms) — the debounced value drives the list query key.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Any section / search change restarts pagination.
    useEffect(() => { setStart(0); }, [sectionType, debouncedSearch]);

    useEffect(() => { onDetailOpenChange?.(Boolean(detail)); }, [detail, onDetailOpenChange]);

    const { data, isLoading, isError, error, isFetching } = useQuery({
        queryKey: ['directMessageList', directAddressId, section.code, start, debouncedSearch],
        queryFn: () => fetchDirectMessageList({
            sectionCode: section.code, directAddressId, start, length: DIRECT_PAGE_SIZE, search: debouncedSearch,
        }),
        enabled: Boolean(directAddressId) && !detail,
        placeholderData: keepPreviousData,
    });

    useEffect(() => {
        if (isError) {
            console.error('Failed to get Direct Messages.', error);
            notifyError(error?.message || 'Failed to get Direct Messages.');
        }
    }, [isError, error, notifyError]);

    const { data: countData } = useQuery({
        queryKey: ['directMessageSectionCounts', directAddressId],
        queryFn: () => fetchDirectMessageSectionCounts(directAddressId),
        enabled: SHOW_SECTION_COUNTS && Boolean(directAddressId),
    });
    const counts = countData?.data || {};

    const rows = useMemo(() => (data?.status === 'success' ? (data.data || []) : []), [data]);
    const recordsTotal = data?.recordsTotal || 0;
    const recordsFiltered = data?.recordsFiltered || 0;

    const refreshList = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['directMessageList'] });
        queryClient.invalidateQueries({ queryKey: ['directMessageSectionCounts'] });
    }, [queryClient]);

    const backToList = useCallback(() => {
        setDetail(null);
        refreshList();
    }, [refreshList]);

    const openRow = (row) => {
        // A draft that never became part of a thread reopens in the composer;
        // everything else opens the conversation reader.
        if (!row.parentMessageId && row.status === DRAFT_STATUS) {
            setDetail({ mode: 'compose', messageId: row.messageId, draftDetails: row });
            return;
        }
        setDetail({
            mode: 'conversation',
            messageId: row.messageId,
            parentMessageId: row.parentMessageId || row.messageId,
        });
    };

    const openPatient = async (patientId) => {
        try {
            await openPatientChart(patientId);
        }
        catch (err) {
            console.error('Failed to open the patient chart.', err);
            notifyError(err?.message || 'Failed to open the patient chart.');
        }
    };

    // ---- pagination counter (legacy getBottomPaginationsHtmlContent) ----
    const endIndex = start + recordsFiltered;
    const prevDisabled = start === 0 || isFetching;
    const nextDisabled = endIndex >= recordsTotal || isFetching;

    return (<div className="eda-list-wrapper">
      <div className="eda-list-head">
        {detail ? (
          <button type="button" className="eda-back-to-list" onClick={backToList}>
            <LegacyIcon icon="fa-arrow-left" className="me-2" />
            <span>{`Back to ${sectionTitleCase(sectionType)}`}</span>
          </button>
        ) : (
          <ul className="nav eda-section-tabs" role="tablist">
            {DIRECT_SECTIONS.map((tab) => (
              <li key={tab.type} className="nav-item" role="presentation">
                <button type="button" role="tab" aria-selected={tab.type === sectionType}
                  className={`nav-link eda-section-tab ${tab.type === sectionType ? 'active' : ''}`}
                  onClick={() => setSectionType(tab.type)}>
                  {tab.label}
                  {SHOW_SECTION_COUNTS && !!counts[tab.countKey] && (
                    <span className="badge rounded-pill eda-section-count">{counts[tab.countKey]}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="eda-list-head-right">
          <div className="icon-input-group eda-search-wrap">
            <input type="text" className="form-control eda-search-input" placeholder="Search Messages"
              value={search} onChange={(e) => setSearch(e.target.value)} disabled={Boolean(detail)} />
            <LegacyIcon icon="mdi-magnify" className="eda-search-icon" />
          </div>
          <button type="button" className="btn btn-primary eda-compose-btn" disabled={Boolean(detail)}
            onClick={() => setDetail({ mode: 'compose' })}>
            <LegacyIcon icon="fa-pen" className="me-2" />Compose
          </button>
        </div>
      </div>

      {detail?.mode === 'conversation' && (
        <DirectAddressConversation
          directAddress={directAddress}
          messageId={detail.messageId}
          parentMessageId={detail.parentMessageId}
          onBack={backToList} />
      )}

      {detail?.mode === 'compose' && (
        <div className="eda-compose-host">
          <DirectAddressCompose
            directAddress={directAddress}
            messageId={detail.messageId}
            draftDetails={detail.draftDetails}
            onClose={backToList} />
        </div>
      )}

      {!detail && (<>
        <div className="eda-list-body custom-scrollbar">
          {isLoading && <div className="p-2"><SkeletonList rows={6} /></div>}
          {!isLoading && !rows.length && (
            <div className="nodata eda-nodata">{`${sectionTitleCase(sectionType)} is empty!`}</div>
          )}
          {!isLoading && rows.map((row, index) => {
            const unread = row.readFlag === 'N' && sectionType !== 'OUTBOUND';
            const snippet = subjectAndPreview({ subject: row.subject, body: row.body });
            return (
              <div key={row.messageId} className={`eda-row ${unread ? 'eda-row-unread' : ''} ${index === 0 ? 'eda-row-first' : ''}`}>
                <div className="eda-col-icon">
                  {unread && <LegacyIcon icon="fa-circle" className="eda-unread-dot" />}
                  <span className="eda-avatar"><LegacyIcon icon="fa-user" /></span>
                </div>
                <div className="eda-col-party" title={sectionType === 'OUTBOUND' ? row.recipientAddress : row.senderAddress}>
                  {fromToSectionContent(sectionType, row.recipientAddress, row.senderAddress)}
                </div>
                <div className="eda-col-preview" role="button" onClick={() => openRow(row)}>
                  <div className="eda-preview-text">
                    <span className={snippet.bold ? 'fw-bold' : ''}>{snippet.subject}</span>
                    {snippet.preview !== null && <span>{` - ${snippet.preview}`}</span>}
                  </div>
                  {sectionType === 'OUTBOUND' && !!row.statusDescription && (
                    <div className={`eda-outbound-status ${ERROR_STATUS_CODES.includes(row.status) ? 'eda-status-error' : ''}`}>
                      {row.statusDescription}
                    </div>
                  )}
                </div>
                <div className="eda-col-patient">
                  <span className={`eda-patient-link ${row.patientId ? 'eda-patient-linked' : ''}`}
                    role={row.patientId ? 'button' : undefined}
                    onClick={row.patientId ? () => openPatient(row.patientId) : undefined}>
                    <LegacyIcon icon="fa-user" className="me-1" />
                    {row.patientName || 'No Patient Linked'}
                  </span>
                </div>
                <div className="eda-col-meta">
                  <LegacyIcon icon="fa-paperclip" className="eda-clip-icon" />
                  <span className="eda-row-date">{formatMessageListDate(row.messageDate)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {rows.length > 0 && (
          <div className="eda-pagination">
            <button type="button" className="btn eda-page-btn" title="Previous Page" disabled={prevDisabled}
              onClick={() => setStart((s) => Math.max(0, s - DIRECT_PAGE_SIZE))}>
              <LegacyIcon icon="fa-angle-left" />
            </button>
            <span className="eda-page-count">{`${start + 1} - ${endIndex} of ${recordsTotal}`}</span>
            <button type="button" className="btn eda-page-btn" title="Next Page" disabled={nextDisabled}
              onClick={() => setStart((s) => s + DIRECT_PAGE_SIZE)}>
              <LegacyIcon icon="fa-angle-right" />
            </button>
          </div>
        )}
      </>)}
    </div>);
};
export default DirectAddressMessageList;
