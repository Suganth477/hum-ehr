import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { fetchConversationList, updateMailStatus } from '../../services/inAppMailService';
import { useNotify } from '../../context/NotificationContext';
import { SkeletonList } from '../../components/common/ContentLoader';
import {
    PAGE_SIZE, ACTION_BY_STATUS, bulkActionsForFolder, rowTrashParams,
    recipientNames, truncateName, rowDistributionIds, subjectSnippet,
    formatListDate, attachmentIconDesc,
} from './inAppMailHelpers';
import { Glyph, ReadDot, StarIcon } from './InAppMailGlyphs';

const swalTheme = Swal.mixin({
    customClass: {
        popup: 'iam-swal-popup',
        title: 'iam-swal-title',
        confirmButton: 'iam-swal-confirm',
        cancelButton: 'iam-swal-cancel',
    },
    buttonsStyling: false,
});

// Bulk action-bar glyphs — exact SVGs + tooltips from the legacy head template.
const BULK_ICON = {
    TRASH: { title: 'Move to trash', viewBox: '0 -960 960 960', path: 'M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z' },
    PERMTRASH: { title: 'Permanent Delete', viewBox: '0 0 24 24', path: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zm2.46-7.12 1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14zM15.5 4l-1-1h-5l-1 1H5v2h14V4z' },
    RESTORE_TRASH: { title: 'Restore Trash', viewBox: '0 0 24 24', path: 'M14,14H16L12,10L8,14H10V18H14V14M6,7H18V19C18,19.5 17.8,20 17.39,20.39C17,20.8 16.5,21 16,21H8C7.5,21 7,20.8 6.61,20.39C6.2,20 6,19.5 6,19V7M19,4V6H5V4H8.5L9.5,3H14.5L15.5,4H19Z' },
    STARD: { title: 'Star', viewBox: '0 0 24 24', path: 'M12,15.39L8.24,17.66L9.23,13.38L5.91,10.5L10.29,10.13L12,6.09L13.71,10.13L18.09,10.5L14.77,13.38L15.76,17.66M22,9.24L14.81,8.63L12,2L9.19,8.63L2,9.24L7.45,13.97L5.82,21L12,17.27L18.18,21L16.54,13.97L22,9.24Z' },
    UNSTARD: { title: 'Remove Star', viewBox: '0 0 24 24', path: 'M22.1 21.5L2.4 1.7L1.1 3L6.9 8.8L2 9.2L7.5 14L5.9 21L12.1 17.3L18.3 21L18 19.8L20.9 22.7L22.1 21.5M15.8 17.7L12 15.4L8.2 17.7L9.2 13.4L5.9 10.5L8.4 10.3L15.8 17.7M11.2 8L10 6.8L12 2L14.8 8.6L22 9.2L16.9 13.6L15.8 12.5L18.2 10.5L13.8 10.1L12.1 6.1L11.2 8Z' },
    READ: { title: 'Mark as read', viewBox: '0 0 24 24', path: 'M12,19c0-3.87,3.13-7,7-7c1.08,0,2.09,0.25,3,0.68V6c0-1.1-0.9-2-2-2H4C2.9,4,2,4.9,2,6v12c0,1.1,0.9,2,2,2h8.08 C12.03,19.67,12,19.34,12,19z M4,6l8,5l8-5v2l-8,5L4,8V6z M17.34,22l-3.54-3.54l1.41-1.41l2.12,2.12l4.24-4.24L23,16.34L17.34,22z' },
    UNREAD: { title: 'Mark as unread', viewBox: '0 0 24 24', path: 'M22,8.98V18c0,1.1-0.9,2-2,2H4c-1.1,0-2-0.9-2-2V6c0-1.1,0.9-2,2-2h10.1C14.04,4.32,14,4.66,14,5 c0,1.48,0.65,2.79,1.67,3.71L12,11L4,6v2l8,5l5.3-3.32C17.84,9.88,18.4,10,19,10C20.13,10,21.16,9.61,22,8.98z M16,5 c0,1.66,1.34,3,3,3s3-1.34,3-3s-1.34-3-3-3S16,3.34,16,5z' },
};

/**
 * In-App Mail conversation list (legacy InAppMailConversationList custom element).
 * Server-side paginated folder list (25/page), search + sort, per-row read/star/trash
 * and multi-select bulk actions, page counter — all backed by TanStack Query, with status
 * changes as mutations that invalidate the list + folder counts. Row click opens the
 * thread (marking it read first), delegated to the parent via `onOpenMail`.
 */
const InAppMailConversationList = ({ folder, search, sort, onSortChange, patientId = null, onOpenMail }) => {
    const { notifySuccess, notifyError } = useNotify();
    const queryClient = useQueryClient();
    const [start, setStart] = useState(0);
    const [selectedIds, setSelectedIds] = useState(() => new Set());

    // Any folder / search / sort change restarts pagination and clears the selection.
    useEffect(() => {
        setStart(0);
        setSelectedIds(new Set());
    }, [folder, search, sort]);

    const { data, isLoading, isError, error, isFetching } = useQuery({
        queryKey: ['inAppMailList', folder, start, search, sort, patientId],
        queryFn: () => fetchConversationList({
            start, length: PAGE_SIZE, search, sortOrder: sort, conversationType: folder, patientId,
        }),
        placeholderData: keepPreviousData,
    });

    useEffect(() => {
        if (isError) {
            console.error('Failed to get the in app mail list.', error);
            notifyError(error?.message || 'Failed to get the in app mail list.');
        }
    }, [isError, error, notifyError]);

    const rows = useMemo(() => data?.data || [], [data]);
    const recordsTotal = data?.recordsTotal || 0;

    // Keep the selection consistent with the currently-loaded rows.
    useEffect(() => {
        setSelectedIds((prev) => {
            if (!prev.size)
                return prev;
            const present = new Set(rows.map((r) => r.mailId));
            const next = new Set([...prev].filter((id) => present.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [rows]);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['inAppMailList'] });
        queryClient.invalidateQueries({ queryKey: ['inAppMailCount'] });
    };

    const statusMutation = useMutation({
        mutationFn: (params) => updateMailStatus(params),
        onSuccess: (_res, variables) => {
            invalidate();
            if (variables.successMessage)
                notifySuccess(variables.successMessage);
            setSelectedIds(new Set());
        },
        onError: (err) => {
            console.error('Failed to change status.', err);
            notifyError('Failed to change status.');
        },
    });

    const applyStatus = ({ statusCode, statusFlag, messageDetailsIdList, successMessage }) => {
        if (!messageDetailsIdList.length)
            return;
        statusMutation.mutate({ statusCode, statusFlag, messageDetailsIdList, successMessage });
    };

    // ---- row-level actions ----

    const toggleRead = (row) => applyStatus({
        statusCode: 'READ',
        statusFlag: row.mailIsRead === 'N' ? 'Y' : 'N',
        messageDetailsIdList: rowDistributionIds(row.distributionList),
        successMessage: `Mail marked as ${row.mailIsRead === 'N' ? 'read' : 'unread'}`,
    });

    const toggleStar = (row) => applyStatus({
        statusCode: 'STARD',
        statusFlag: row.isFavouriteMail === 'Y' ? 'N' : 'Y',
        messageDetailsIdList: rowDistributionIds(row.distributionList),
        successMessage: `Mail ${row.isFavouriteMail === 'Y' ? 'Unstarred' : 'Starred'} Successfully`,
    });

    const rowTrash = async (row, isPermanentIcon, isRestore) => {
        const confirmText = isRestore
            ? 'Are you sure about to restore from trash?'
            : isPermanentIcon
                ? 'Do you want to delete the mail permanently?'
                : 'Are you sure about move the mail to trash?';
        const confirm = await swalTheme.fire({ title: 'Confirmation Alert', text: confirmText, showCancelButton: true, confirmButtonText: 'Yes', cancelButtonText: 'No' });
        if (!confirm.isConfirmed)
            return;
        const { statusCode, statusFlag } = rowTrashParams(folder, row.mailIsTrash, isPermanentIcon);
        applyStatus({
            statusCode,
            statusFlag,
            messageDetailsIdList: rowDistributionIds(row.distributionList),
            successMessage: statusCode === 'PERMTRASH'
                ? 'Mail Deleted Permanently'
                : `Mail moved to ${statusFlag === 'Y' ? 'trash' : 'inbox'}`,
        });
    };

    const openMail = (row) => {
        // Legacy marks the mail read on open (silently) before showing the thread.
        if (row.mailIsRead === 'N')
            applyStatus({
                statusCode: 'READ', statusFlag: 'Y', messageDetailsIdList: rowDistributionIds(row.distributionList),
            });
        // Hand the thread reader the parent id + this page's ordered ids (prev/next nav) + folder total.
        onOpenMail?.({ parentMailId: row.parentMailId, siblings: rows.map((r) => r.parentMailId), recordsTotal });
    };

    // ---- bulk actions ----

    const selectedRows = useMemo(() => rows.filter((r) => selectedIds.has(r.mailId)), [rows, selectedIds]);
    const allSelected = rows.length > 0 && selectedIds.size === rows.length;

    const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(rows.map((r) => r.mailId)));
    const toggleRow = (mailId) => setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(mailId))
            next.delete(mailId);
        else
            next.add(mailId);
        return next;
    });

    const runBulk = async (actionKey) => {
        const action = ACTION_BY_STATUS[actionKey];
        const confirm = await swalTheme.fire({ title: 'Confirmation Alert', text: action.confirmationContent, showCancelButton: true, confirmButtonText: 'Yes', cancelButtonText: 'No' });
        if (!confirm.isConfirmed)
            return;
        const messageDetailsIdList = selectedRows.flatMap((r) => rowDistributionIds(r.distributionList));
        applyStatus({ statusCode: action.statusCode, statusFlag: action.statusFlag, messageDetailsIdList });
    };

    const bulkActions = bulkActionsForFolder(folder);
    const showActions = selectedIds.size > 0;

    // ---- pagination counter ----
    const startIndex = rows.length ? start + 1 : 0;
    const endIndex = rows.length ? start + rows.length : 0;
    const prevDisabled = start === 0 || isFetching;
    const nextDisabled = rows.length !== PAGE_SIZE || recordsTotal <= rows.length + start || isFetching;

    return (<div className="iam-list">
      <div className="iam-list-head">
        <div className="iam-list-head-left">
          <input type="checkbox" className="iam-check-all" checked={allSelected}
            disabled={!rows.length} onChange={toggleSelectAll} aria-label="Select all mail" />
          {showActions && (
            <span className="iam-action-bar">
              {bulkActions.map((key) => (
                <button key={key} type="button" className="iam-action-btn" title={BULK_ICON[key].title}
                  onClick={() => runBulk(key)} disabled={statusMutation.isPending}>
                  <Glyph viewBox={BULK_ICON[key].viewBox} path={BULK_ICON[key].path} fill="#000" />
                </button>
              ))}
            </span>
          )}
        </div>
        <div className="iam-list-head-right">
          <select className="form-control iam-sort-select" value={sort} aria-label="Sort mail"
            onChange={(e) => onSortChange?.(e.target.value)}>
            <option value="asc">Newest</option>
            <option value="desc">Oldest</option>
          </select>
          <span className="iam-page-count">{`${startIndex} - ${endIndex} of ${recordsTotal}`}</span>
          <button type="button" className="iam-page-btn" title="Previous Page" disabled={prevDisabled}
            onClick={() => setStart((s) => Math.max(0, s - PAGE_SIZE))}>
            <Glyph viewBox="0 -960 960 960" fill="#000" path="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" />
          </button>
          <button type="button" className="iam-page-btn" title="Next Page" disabled={nextDisabled}
            onClick={() => setStart((s) => s + PAGE_SIZE)}>
            <Glyph viewBox="0 -960 960 960" fill="#000" path="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" />
          </button>
        </div>
      </div>

      <div className="iam-list-body custom-scrollbar">
        {isLoading && <div className="p-2"><SkeletonList rows={8} /></div>}
        {!isLoading && rows.length === 0 && (
          <div className="nodata iam-nodata">
            {`${folder.charAt(0)}${folder.slice(1).toLowerCase()} is empty!`}
          </div>
        )}
        {!isLoading && rows.map((row) => {
          const names = truncateName(recipientNames(row.distributionList));
          const snip = subjectSnippet(row.subjectName, row.messageBodyText, row.mailCount, row.mailIsRead, row.mailStatus);
          const attach = row.fileDetails?.length ? attachmentIconDesc(row.fileDetails[0].fileFormat, row.fileDetails.length) : null;
          const unread = row.mailIsRead === 'N';
          return (
            <div key={row.mailId} className={`iam-row ${unread ? 'iam-row-unread' : ''}`}>
              <div className="iam-col-select">
                <input type="checkbox" className="iam-row-check" checked={selectedIds.has(row.mailId)}
                  onChange={() => toggleRow(row.mailId)} aria-label="Select mail" />
                <span role="button" title="Mark as read/unread" onClick={() => toggleRead(row)}>
                  <ReadDot read={!unread} />
                </span>
              </div>
              <div className={`iam-col-name text-capitalize ${unread ? 'fw-bold' : ''}`} title={recipientNames(row.distributionList)}
                role="button" onClick={() => openMail(row)}>{names}</div>
              <div className="iam-col-star" role="button" title="Star" onClick={() => toggleStar(row)}>
                <StarIcon starred={row.isFavouriteMail === 'Y'} />
              </div>
              <div className="iam-col-subject" role="button" onClick={() => openMail(row)}>
                {snip.longSubject
                  ? (<span className={`iam-subject ${snip.unread ? 'fw-bold' : ''}`}>{snip.subject}{snip.ellipsis ? '...' : ''}</span>)
                  : (<>
                      <span className={`iam-subject ${snip.unread ? 'fw-bold' : ''}`}>{snip.subject}</span>
                      {' '}<span className="iam-mail-count">{snip.count}</span>
                      {snip.isDraft && <span className="iam-draft-text"> DRAFTS</span>}
                      {' '}<span className="iam-snippet text-muted">{snip.snippet}</span>{snip.ellipsis ? '...' : ''}
                    </>)}
              </div>
              <div className="iam-col-attach">
                {attach && <Glyph viewBox={attach.viewBox} path={attach.path} width={18} height={18} fill="grey" />}
              </div>
              <div className="iam-col-date" role="button" onClick={() => openMail(row)}>{formatListDate(row.mailDateTime)}</div>
              {!patientId && (
                <div className="iam-col-action">
                  {folder === 'TRASH' && (
                    <button type="button" className="iam-row-action-btn" title="Restore Trash" onClick={() => rowTrash(row, false, true)}>
                      <Glyph viewBox="0 0 24 24" fill="#000" path="M14,14H16L12,10L8,14H10V18H14V14M6,7H18V19C18,19.5 17.8,20 17.39,20.39C17,20.8 16.5,21 16,21H8C7.5,21 7,20.8 6.61,20.39C6.2,20 6,19.5 6,19V7M19,4V6H5V4H8.5L9.5,3H14.5L15.5,4H19Z" />
                    </button>
                  )}
                  {(folder === 'TRASH' || folder === 'DRAFTS')
                    ? (<button type="button" className="iam-row-action-btn" title="Permanent Delete" onClick={() => rowTrash(row, true, false)}>
                        <Glyph viewBox="0 0 24 24" fill="#000" path="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zm2.46-7.12 1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14zM15.5 4l-1-1h-5l-1 1H5v2h14V4z" />
                      </button>)
                    : (<button type="button" className="iam-row-action-btn" title="Move to Trash" onClick={() => rowTrash(row, false, false)}>
                        <Glyph viewBox="0 -960 960 960" fill="#000" path="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
                      </button>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>);
};
export default InAppMailConversationList;
