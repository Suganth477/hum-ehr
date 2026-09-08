import { useCallback, useEffect, useRef, useState } from 'react';
import moment from '../../../utils/dayjs';
import { fetchPreferencesList } from '../../../services/preferencesService';
import { SkeletonList } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';
import DeletedRecordBadge from '../../../components/common/DeletedRecordBadge';

const relativeTime = (value) => {
    if (!value) return '';
    const parsed = moment(value, ['MM-DD-YYYY hh:mm A', 'MM-DD-YYYY', moment.ISO_8601], true);
    return parsed.isValid() ? parsed.fromNow() : value;
};

/**
 * Left-pane preferences list for one (recordType, preferencesType). In the history view
 * a "show deleted" toggle includes invalidFlag='Y' records. Auto-selects the first row.
 */
const PatientPreferencesList = ({ patientId, recordType, preferencesType, lookups, searchTerm, showDeleted, refreshKey, selectedId, onSelect }) => {
    const [records, setRecords] = useState(null); // null = fetching (skeleton)
    const { notifyError } = useNotify();
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    const titleFor = useCallback((record) => {
        const item = (lookups || []).find((l) => l.code === record.code);
        return item ? item.label : (record.description || record.code || 'Preference');
    }, [lookups]);

    const loadList = useCallback(async (search) => {
        setRecords(null);
        try {
            const { records: list } = await fetchPreferencesList({ patientId, recordType, preferencesType, searchValue: search });
            // History: hide deleted (invalidFlag 'Y') unless "show deleted" is on.
            const visible = recordType === 'history' && !showDeleted ? list.filter((r) => r.invalidFlag === 'N') : list;
            setRecords(visible);
            onSelectRef.current?.(visible[0] || null);
        }
        catch (error) {
            console.error('Failed to fetch preferences list.', error);
            setRecords([]);
            onSelectRef.current?.(null);
            notifyError(error?.message || 'Failed to fetch the preferences list.');
        }
    }, [patientId, recordType, preferencesType, showDeleted, notifyError]);

    useEffect(() => {
        const timer = window.setTimeout(() => { loadList((searchTerm || '').trim()); }, 350);
        return () => window.clearTimeout(timer);
    }, [searchTerm, refreshKey, loadList]);

    if (records === null)
        return <SkeletonList rows={5}/>;

    if (!records.length)
        return (<div className="list-wrapper pc-no-list-data-container">
          <div className="nodata d-flex justify-content-center align-items-center">
            <div className="me-2"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/></div>
            <div style={{ fontSize: 18 }}>No preferences recorded.</div>
          </div>
        </div>);

    return (<>
      {records.map((record) => {
        const isActive = String(record.id) === String(selectedId);
        const title = titleFor(record);
        const sliced = title && title.length > 45 ? `${title.slice(0, 45)}...` : title;
        return (<div key={record.id} className={`row each-preferences-detail-container pc-list-each-details-container ${isActive ? 'active' : ''} m-1 p-1`} data-id={record.id} onClick={() => onSelect(record)}>
            <div className="col-md-9 preferences-name pe-0 text-capitalize" title={title !== sliced ? title : undefined}>{sliced}{record.invalidFlag === 'Y' && <DeletedRecordBadge />}</div>
            <div className="col-md-3 pe-0">
              <div className="preferences-date pc-list-each-details-date-container">{record.effectiveDate ? relativeTime(record.effectiveDate) : ''}</div>
            </div>
          </div>);
      })}
    </>);
};
export default PatientPreferencesList;
