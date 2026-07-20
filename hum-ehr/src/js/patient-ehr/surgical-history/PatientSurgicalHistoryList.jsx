import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSurgicalHistoryList } from '../../../services/surgicalHistoryService';
import { SkeletonList } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';

/**
 * Surgical history list (legacy patient-surgical-history-list). One fetch returns
 * active + deleted records; the "View marked as error" toggle switches between the
 * client-side splits (deleted rows struck through). Auto-selects the first row (or
 * the just-edited record).
 */
const PatientSurgicalHistoryList = ({ patientId, searchTerm, showDeleted, refreshKey, selectId, selectedId, onSelect }) => {
    const [lists, setLists] = useState(null); // null = fetching (skeleton)
    const { notifyError } = useNotify();
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const showDeletedRef = useRef(showDeleted);
    showDeletedRef.current = showDeleted;

    const load = useCallback(async (search, preferId) => {
        setLists(null);
        try {
            const { activeList, deletedList } = await fetchSurgicalHistoryList({ patientId, search });
            setLists({ activeList, deletedList });
            const visible = showDeletedRef.current ? deletedList : activeList;
            const preferred = preferId ? visible.find((r) => String(r.id) === String(preferId)) : null;
            onSelectRef.current?.(preferred || visible[0] || null);
        }
        catch (error) {
            console.error('Failed to get surgical history records.', error);
            setLists({ activeList: [], deletedList: [] });
            onSelectRef.current?.(null);
            notifyError(error?.message || 'Failed to get surgical history the record. Please try again.');
        }
    }, [patientId, notifyError]);

    useEffect(() => {
        const timer = window.setTimeout(() => { load((searchTerm || '').trim(), selectId); }, 350);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, refreshKey, load]);

    useEffect(() => {
        if (!lists) return;
        const visible = showDeleted ? lists.deletedList : lists.activeList;
        onSelectRef.current?.(visible[0] || null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDeleted]);

    if (lists === null)
        return <SkeletonList rows={5}/>;

    const visible = showDeleted ? lists.deletedList : lists.activeList;

    if (!visible.length)
        return (<div className="list-wrapper pc-no-list-data-container">
          <div className="nodata d-flex justify-content-start align-items-center">
            <div className="me-2"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/></div>
            <div style={{ fontSize: 18 }}>Patient doesn't have any surgical history yet!</div>
          </div>
        </div>);

    return (<>
      {visible.map((record) => {
        const isActive = String(record.id) === String(selectedId);
        const struck = record.invalidFlag === 'Y' ? 'deleted-surgical-history-record' : '';
        const name = (record.surgeryName || '').slice(0, 50) + ((record.surgeryName || '').length > 50 ? '...' : '');
        return (<div key={record.id} className={`row surgical-history-each-detail-container pc-list-each-details-container ${isActive ? 'active' : ''} m-1 p-1`} data-id={record.id} onClick={() => onSelect(record)}>
            <div className={`col-md-9 surgery-name text-capitalize pe-0 ${struck}`}>{name}</div>
            <div className="col-md-3 pe-0">
              <div className={`surgery-date pc-list-each-details-date-container ${struck}`}>{record.surgeryDateTime}</div>
            </div>
          </div>);
      })}
    </>);
};
export default PatientSurgicalHistoryList;
