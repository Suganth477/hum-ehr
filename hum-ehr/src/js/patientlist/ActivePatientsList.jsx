import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Paginator } from 'primereact/paginator';
import { fetchActivePatients } from '../../services/patientService';
import { DEBOUNCE_PATIENT_LIST_MS } from '../../constants/timing';
import { useLayout } from '../../context/LayoutContext';
import { usePatientListFilter } from '../../context/PatientListFilterContext';
import { useNotify } from '../../context/NotificationContext';
import { useIsTabletOrBelow } from '../../hooks/useMediaQuery';
import { SkeletonTable } from '../../components/common/ContentLoader';
import { LegacyIcon } from '../../components/common/CustomIcons';
import './ActivePatientsList.css';

// PatientChart (+ its 12 code-split sections) loads only when a patient tab opens.
const PatientChart = lazy(() => import('../patient-ehr/PatientChart'));
const DEFAULT_FILTERS = {
	productCode: '',
	facilityId: '',
	physicianId: '',
	clinicianId: '',
	clinicianRoleStatus: 'ALL',
	physicianRoleStatus: 'ALL',
	fromDate: '',
	toDate: '',
	programStatus: 'ALL',
	search: '',
	searchColumn: 'PATIENNAME',
};
// DSI (Decision Support Intervention) alert badge — count + info-circle, red when the
// patient has active alerts, grey otherwise (legacy active.patient.js _constructPatientDsiAlert).
const DsiAlertCell = ({ count = 0 }) => {
	const has = count > 0;
	const color = has ? '#FF0000' : '#526172';
	const bg = has ? '#FFDCDC' : '#F0F0F0';
	const title = has ? `Patient has ${count} DSI alert${count > 1 ? 's' : ''}` : 'Patient has no active DSI alerts';
	return (<span className="active-patient-dsi-alert d-inline-flex align-items-center" title={title} data-dsi-alert-count={count}>
		<span className="me-1 fw-semibold" style={{ color }}>{count || 0}</span>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<rect width="24" height="24" rx="12" fill={bg} />
			<path d="M12.0002 8.16602C12.1328 8.16602 12.2599 8.21869 12.3537 8.31246C12.4475 8.40623 12.5002 8.53341 12.5002 8.66602V12.666C12.5002 12.7986 12.4475 12.9258 12.3537 13.0196C12.2599 13.1133 12.1328 13.166 12.0002 13.166C11.8676 13.166 11.7404 13.1133 11.6466 13.0196C11.5528 12.9258 11.5002 12.7986 11.5002 12.666V8.66602C11.5002 8.53341 11.5528 8.40623 11.6466 8.31246C11.7404 8.21869 11.8676 8.16602 12.0002 8.16602ZM12.0002 15.3327C12.177 15.3327 12.3465 15.2624 12.4716 15.1374C12.5966 15.0124 12.6668 14.8428 12.6668 14.666C12.6668 14.4892 12.5966 14.3196 12.4716 14.1946C12.3465 14.0696 12.177 13.9993 12.0002 13.9993C11.8234 13.9993 11.6538 14.0696 11.5288 14.1946C11.4037 14.3196 11.3335 14.4892 11.3335 14.666C11.3335 14.8428 11.4037 15.0124 11.5288 15.1374C11.6538 15.2624 11.8234 15.3327 12.0002 15.3327Z" fill={color} />
			<path fillRule="evenodd" clipRule="evenodd" d="M4.8335 12.0007C4.8335 8.04265 8.04216 4.83398 12.0002 4.83398C15.9582 4.83398 19.1668 8.04265 19.1668 12.0007C19.1668 15.9587 15.9582 19.1673 12.0002 19.1673C8.04216 19.1673 4.8335 15.9587 4.8335 12.0007ZM12.0002 5.83398C10.3647 5.83398 8.79615 6.48368 7.63967 7.64016C6.4832 8.79663 5.8335 10.3651 5.8335 12.0007C5.8335 13.6362 6.4832 15.2047 7.63967 16.3611C8.79615 17.5176 10.3647 18.1673 12.0002 18.1673C13.6357 18.1673 15.2042 17.5176 16.3607 16.3611C17.5171 15.2047 18.1668 13.6362 18.1668 12.0007C18.1668 10.3651 17.5171 8.79663 16.3607 7.64016C15.2042 6.48368 13.6357 5.83398 12.0002 5.83398Z" fill={color} />
		</svg>
	</span>);
};
const ActivePatientsList = ({ activeTab, onOpenTab }) => {
	const [patients, setPatients] = useState(null); // null = fetching (skeleton)
	const [first, setFirst] = useState(0);
	const [rows, setRows] = useState(10);
	const [totalRecords, setTotalRecords] = useState(0);
	const [filters, setFilters] = useState(DEFAULT_FILTERS);
	const [sortMeta, setSortMeta] = useState({
		sortField: 'fullName',
		sortOrder: 1,
	});
	const { setChartView } = useLayout();
	const { appliedFilters } = usePatientListFilter();
	const { notifyError } = useNotify();
	// Cards on phones AND tablets (< lg); the dense DataTable only on desktop
	// where its fixed-width columns fit without forcing horizontal page scroll.
	const showCards = useIsTabletOrBelow();
	const isPatientListTab = activeTab === 'patient_list';
	// The offcanvas filter (Gender / Age / Primary Provider / DSI Alert) is merged over the
	// header search filters before the request is built.
	const mergedFilters = useMemo(() => ({ ...filters, ...appliedFilters }), [filters, appliedFilters]);
	const requestParams = useMemo(() => ({ draw: 1, rows, first, filters: mergedFilters, sortField: sortMeta.sortField, sortOrder: sortMeta.sortOrder }), [rows, first, mergedFilters, sortMeta]);
	const loadPatients = useCallback(async () => {
		if (!isPatientListTab)
			return;
		setPatients(null);
		try {
			const response = await fetchActivePatients(requestParams);
			setPatients(response.rows);
			setTotalRecords(response.totalRecords);
			const countBadge = document.getElementById('patient_list_filter_count');
			if (countBadge)
				countBadge.innerText = String(response.totalRecords);
		}
		catch (error) {
			console.error('Failed to load active patients.', error);
			setPatients([]);
			notifyError(error?.message || 'Unable to load patients. Please try again.');
		}
	}, [isPatientListTab, requestParams, notifyError]);

	useEffect(() => {
		const timerId = window.setTimeout(loadPatients, DEBOUNCE_PATIENT_LIST_MS);
		return () => window.clearTimeout(timerId);
	}, [loadPatients]);

	// Applying an offcanvas filter returns to the first page.
	useEffect(() => { setFirst(0); }, [appliedFilters]);

	useEffect(() => {
		// The patient chart view collapses the side nav; the list view restores
		// it. LayoutContext owns the body/side-nav classes now.
		setChartView(!isPatientListTab);
	}, [isPatientListTab, setChartView]);

	const updateFilter = (key, value) => {
		setFirst(0);
		setFilters((previous) => ({ ...previous, [key]: value }));
	};
	const onPageChange = (event) => {
		setFirst(event.first);
		setRows(event.rows);
	};
	const onSortChange = (event) => {
		setSortMeta({
			sortField: event.sortField || 'fullName',
			sortOrder: (event.sortOrder ?? 1) === -1 ? -1 : 1,
		});
	};
	const phoneBodyTemplate = (patient) => {
		const phoneRows = [
			{ value: patient.mobilePhoneNumber, flag: patient.mobilePhoneInvalidFlag, label: 'MPH' },
			{ value: patient.homePhoneNumber, flag: patient.pagerPhoneInvalidFlag, label: 'HPH' },
			{ value: patient.workPhoneNumber, flag: patient.workPhoneInvalidFlag, label: 'WPH' },
		];
		return (<div className="table-data">
			{phoneRows.filter((phone) => phone.value).map((phone) => (<span key={phone.label} className={phone.flag === 'Y' ? 'invalid-number d-block' : 'd-block'}>
				{phone.value} ({phone.label})
			</span>))}
		</div>);
	};
	const nameBodyTemplate = (patient) => (<button type="button" className="active-patient-name-link btn btn-link text-capitalize p-0 text-decoration-none" title="Patient Profile" onClick={() => onOpenTab?.(patient.patientId, patient.fullName, patient.genderCode)}>
		{patient.fullName}
	</button>);
	const SkeletonTable = () => (
		<div className="active-patient-table-scroll">
			<table className="table table-hover border w-100">
				<thead className="table-light">
					<tr>
						{['S.No', 'Name', 'Date of Birth', 'Age', 'Gender', 'Contact No', 'EMR Id', 'DSI Alert', 'Action'].map((h) => (
							<th key={h} className="small text-muted fw-semibold">{h}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{Array.from({ length: rows }).map((_, i) => (
						<tr key={i}>
							{[70, 180, 120, 80, 100, 180, 120, 110, 100].map((w, j) => (
								<td key={j}><div className="apl-skeleton-bar" style={{ width: j === 0 ? 24 : `${60 + Math.round((w * 0.4))}px` }} /></td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
	if (!isPatientListTab) {
		return (<div className="container-fluid tab-content hh-ehr-bg-color9 p-0 h-100 position-relative">
			<div className="tab-pane patient-chart-tab-pane fade show active" id={`${activeTab}_chart_tab_pane`} role="tabpanel">
				<div id={`patient_chart_wrapper_${activeTab}`} className="p-0 bg-white rounded">
					<Suspense fallback={<SkeletonTable/>}><PatientChart patientId={activeTab} /></Suspense>
				</div>
			</div>
		</div>);
	}
	return (<div id="patient_chart_main_container" className="container-fluid tab-content hh-ehr-bg-color9 p-0 h-100 position-relative">
		<div className="tab-pane patient-chart-tab-pane fade show active px-3" id="patient_list_container" role="tabpanel">
			<div className="patient-chart-header-main-container px-3 mt-3">
				<div className="d-flex align-items-center patient-chart-header-input-container pb-2">
					<div className="patient-chart-header-search-input-group">
						<div className="patient-chart-search-input-icon-container">
							<input type="text" name="patient_chart_patient_list_search_input" id="patient_chart_patient_list_search_input" maxLength={25} className="form-control text-capitalize" placeholder="Search Patient Name" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} />
							<LegacyIcon icon="fa-magnifying-glass" className="input-icon" />
						</div>
					</div>
					<div className="patient-chart-header-action-container d-flex gap-3 align-items-center">
						<button className="btn btn-primary mt-1 btn-md border-radius-button border-0 d-flex align-items-center gap-2" type="button" id="patient_chart_add_new_patient_btn_id" onClick={() => console.warn('Create New Patient workflow is not migrated yet.')}>
							<LegacyIcon icon="mdi-plus" />
							<span>Create New Patient</span>
						</button>
					</div>
				</div>
			</div>

			{showCards ? (<div className="patient-card-list mt-2">
					{patients === null && <SkeletonTable />}
					{patients !== null && patients.length === 0 && <div className="p-3 text-muted">No patients found.</div>}
					{(patients || []).map((patient) => (<div key={patient.patientId} className="patient-card card mb-2 shadow-sm">
						<div className="card-body p-2">
							<div className="d-flex justify-content-between align-items-start gap-2">
								{nameBodyTemplate(patient)}
								<LegacyIcon icon="mdi-dots-vertical" className="action-group-icon" />
							</div>
							<div className="row g-1 small mt-1">
								<div className="col-6"><span className="text-muted">Gender:</span> {patient.gender || '-'}</div>
								<div className="col-6"><span className="text-muted">DOB:</span> {patient.dob || '-'}</div>
								<div className="col-6"><span className="text-muted">Age:</span> {patient.age || '-'}</div>
								<div className="col-6 text-uppercase"><span className="text-muted text-capitalize">EMR:</span> {patient.emrId || '-'}</div>
								<div className="col-6 d-flex align-items-center gap-1"><span className="text-muted">DSI:</span> <DsiAlertCell count={patient.dsiAlertCount} /></div>
								<div className="col-12">{phoneBodyTemplate(patient)}</div>
							</div>
						</div>
					</div>))}
					{totalRecords > 0 && (<Paginator first={first} rows={rows} totalRecords={totalRecords} onPageChange={onPageChange} rowsPerPageOptions={[5, 10, 25, 50]} />)}
				</div>) : (patients === null ? <SkeletonTable /> : <div className="active-patient-table-scroll">
					<DataTable value={patients} lazy paginator first={first} rows={rows} totalRecords={totalRecords} onPage={onPageChange} sortField={sortMeta.sortField} sortOrder={sortMeta.sortOrder} onSort={onSortChange} rowsPerPageOptions={[5, 10, 25, 50]} emptyMessage="No patients found." scrollable scrollHeight="65vh" className="p-datatable-striped active-patient-table" id="care_group_active_patients" tableClassName="table table-hover border w-100">
					<Column field="sno" header="S.No" style={{ width: '70px' }} body={(row) => <div className="table-data">{row.sno}</div>} />
					<Column field="fullName" header="Name" sortable style={{ width: '180px' }} body={nameBodyTemplate} />
					<Column field="dob" header="Date of Birth" sortable style={{ width: '120px' }} body={(row) => <div className="table-data">{row.dob}</div>} />
					<Column field="age" header="Age" style={{ width: '80px' }} body={(row) => <div className="table-data">{row.age}</div>} />
					<Column field="gender" header="Gender" sortable style={{ width: '100px' }} body={(row) => <div className="table-data">{row.gender}</div>} />
					<Column header="Contact No" style={{ width: '180px' }} body={phoneBodyTemplate} />
					<Column field="emrId" header="EMR Id" sortable style={{ width: '120px' }} body={(row) => <div className="table-data text-uppercase">{row.emrId}</div>} />
					<Column header="DSI Alert" style={{ width: '110px' }} body={(row) => <div className="table-data" role="button" onClick={() => onOpenTab?.(row.patientId, row.fullName, row.genderCode)}><DsiAlertCell count={row.dsiAlertCount} /></div>} />
					<Column header="Action" style={{ width: '100px' }} body={() => <LegacyIcon icon="mdi-dots-vertical" className="action-group-icon" />} />
				</DataTable></div>)}
		</div>
	</div>);
};
export default ActivePatientsList;