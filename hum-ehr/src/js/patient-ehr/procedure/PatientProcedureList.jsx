import { useCallback, useEffect, useRef, useState } from 'react';
import moment from '../../../utils/dayjs';
import { fetchProcedureList } from '../../../services/procedureService';
import { SkeletonList } from '../../../components/common/ContentLoader';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import DeletedRecordBadge from '../../../components/common/DeletedRecordBadge';

// Legacy utility.convertMDY12HtoMDY: "MM-DD-YYYY hh:mm A" → "MM-DD-YYYY".
const dateOnly = (value) => {
    if (!value) return '';
    const parsed = moment(value, ['MM-DD-YYYY hh:mm A', 'MM-DD-YYYY', moment.ISO_8601], true);
    return parsed.isValid() ? parsed.format('MM-DD-YYYY') : value;
};

/**
 * Procedure list (legacy patient-procedure-list-item). One fetch returns active +
 * deleted records; the "Show Deleted Records" toggle switches between the client-side
 * splits. Deleted rows render struck through. Auto-selects the first row (or the
 * just-edited record after a save).
 */
const PatientProcedureList = ({ patientId, searchTerm, showDeleted, refreshKey, selectId, selectedId, onSelect }) => {
    const [lists, setLists] = useState(null); // null = fetching (skeleton)
    const { notifyError } = useNotify();
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const showDeletedRef = useRef(showDeleted);
    showDeletedRef.current = showDeleted;

    const load = useCallback(async (search, preferId) => {
        setLists(null);
        try {
            const { activeList, deletedList } = await fetchProcedureList({ patientId, search });
            setLists({ activeList, deletedList });
            const visible = showDeletedRef.current ? deletedList : activeList;
            const preferred = preferId ? visible.find((r) => String(r.id) === String(preferId)) : null;
            onSelectRef.current?.(preferred || visible[0] || null);
        }
        catch (error) {
            console.error('Failed to fetch patient procedure details.', error);
            setLists({ activeList: [], deletedList: [] });
            onSelectRef.current?.(null);
            notifyError(error?.message || 'Failed to fetch patient procedure details. Please try again.');
        }
    }, [patientId, notifyError]);

    useEffect(() => {
        const timer = window.setTimeout(() => { load((searchTerm || '').trim(), selectId); }, 350);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, refreshKey, load]);

    // Toggling "Show Deleted Records" re-renders from the already-fetched splits.
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
            <div className="me-1"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/></div>
            <div style={{ fontSize: 18 }}>Patient doesn't have {showDeleted ? 'error' : 'active'} procedure list items</div>
          </div>
        </div>);

    return (<>
      {visible.map((record) => {
        const isActive = String(record.id) === String(selectedId);
        const isDeleted = record.invalidFlag === 'Y';
        return (<div key={record.id} className={`row pcps-patient-procedure-each-list-container pc-list-each-details-container m-1 p-1 ${isActive ? 'active' : ''}`} data-id={record.id} onClick={() => onSelect(record)}>
            <div className="pcps-patient-procedure-name-date-container">
              <div style={{ fontSize: 14 }} className="text-capitalize">{`${record.procedureCode} - ${record.procedureDescription}`}</div>
              {isDeleted && <DeletedRecordBadge />}
            </div>
            <div className="pcps-patient-procedure-name-date-container">
              <div className="float-end">{dateOnly(record.dateOfService)}</div>
            </div>
          </div>);
      })}
    </>);
};
export default PatientProcedureList;
