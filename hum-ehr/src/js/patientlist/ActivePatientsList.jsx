import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import PatientChart from '../patient-ehr/PatientChart';
import { fetchActivePatients } from '../../services/patientService';
import './ActivePatientsList.css';

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

const ActivePatientsList = ({ activeTab, onOpenTab }) => {
	const [patients, setPatients] = useState([]);
	const [loading, setLoading] = useState(false);
	const [first, setFirst] = useState(0);
	const [rows, setRows] = useState(10);
	const [totalRecords, setTotalRecords] = useState(0);
	const [filters, setFilters] = useState(DEFAULT_FILTERS);
	const [sortMeta, setSortMeta] = useState({ sortField: 'fullName', sortOrder: 1 });

	const isPatientListTab = activeTab === 'patient_list';

	const requestParams = useMemo(() => ({
		draw: 1,
		rows,
		first,
		filters,
		sortField: sortMeta.sortField,
		sortOrder: sortMeta.sortOrder,
	}), [rows, first, filters, sortMeta]);

	const loadPatients = useCallback(async () => {
		if (!isPatientListTab) return;
		setLoading(true);

		try {
			const response = await fetchActivePatients(requestParams);
			setPatients(response.rows);
			setTotalRecords(response.totalRecords);

			const countBadge = document.getElementById('patient_list_filter_count');
			if (countBadge) countBadge.innerText = response.totalRecords;
		} catch (error) {
			console.error('Failed to load active patients.', error);
		} finally {
			setLoading(false);
		}
	}, [isPatientListTab, requestParams]);

	useEffect(() => {
		const timerId = window.setTimeout(loadPatients, 350);
		return () => window.clearTimeout(timerId);
	}, [loadPatients]);

	useEffect(() => {
		const sideNavMenu = document.getElementById('application_side_navigation_menu_container');
		if (!sideNavMenu) return;

		if (!isPatientListTab) {
			document.body.classList.add('expanded-view', 'ignore-menu-icon-view');
			sideNavMenu.classList.add('d-none');
		} else {
			document.body.classList.remove('expanded-view', 'ignore-menu-icon-view');
			sideNavMenu.classList.remove('d-none');
		}
	}, [isPatientListTab]);

	const updateFilter = (key, value) => {
		setFirst(0);
		setFilters((previous) => ({ ...previous, [key]: value }));
	};

	const onPageChange = (event) => {
		setFirst(event.first);
		setRows(event.rows);
	};

	const onSortChange = (event) => {
		setSortMeta({ sortField: event.sortField || 'fullName', sortOrder: event.sortOrder || 1 });
	};

	const phoneBodyTemplate = (patient) => {
		const phoneRows = [
			{ value: patient.mobilePhoneNumber, flag: patient.mobilePhoneInvalidFlag, label: 'MPH' },
			{ value: patient.homePhoneNumber, flag: patient.pagerPhoneInvalidFlag, label: 'HPH' },
			{ value: patient.workPhoneNumber, flag: patient.workPhoneInvalidFlag, label: 'WPH' },
		];

		return (
			<div className="table-data">
				{phoneRows.filter((phone) => phone.value).map((phone) => (
					<span
						key={phone.label}
						className={phone.flag === 'Y' ? 'invalid-number d-block' : 'd-block'}
					>
						{phone.value} ({phone.label})
					</span>
				))}
			</div>
		);
	};

	const nameBodyTemplate = (patient) => (
		<button
			type="button"
			className="active-patient-name-link btn btn-link text-capitalize p-0 text-decoration-none"
			title="Patient Profile"
			onClick={() => onOpenTab?.(patient.patientId, patient.fullName, patient.genderCode)}
		>
			{patient.fullName}
		</button>
	);

	if (!isPatientListTab) {
		return (
			<div className="container-fluid tab-content hh-ehr-bg-color9 p-0 h-100 position-relative">
				<div className="tab-pane patient-chart-tab-pane fade show active" id={`${activeTab}_chart_tab_pane`} role="tabpanel">
					<div id={`patient_chart_wrapper_${activeTab}`} className="p-0 bg-white rounded">
						<PatientChart patientId={activeTab} />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div id="patient_chart_main_container" className="container-fluid tab-content hh-ehr-bg-color9 p-0 h-100 position-relative">
			<div className="tab-pane patient-chart-tab-pane fade show active px-3" id="patient_list_container" role="tabpanel">
				<div className="patient-chart-header-main-container px-3 mt-3">
					<div className="d-flex align-items-center patient-chart-header-input-container pb-2">
						<div className="patient-chart-header-search-input-group">
							<div className="patient-chart-search-input-icon-container">
								<input
									type="text"
									name="patient_chart_patient_list_search_input"
									id="patient_chart_patient_list_search_input"
									maxLength="25"
									className="form-control text-capitalize"
									placeholder="Search Patient Name"
									value={filters.search}
									onChange={(event) => updateFilter('search', event.target.value)}
								/>
								<i className="fa fa-solid fa-magnifying-glass mdi mdi-magnify input-icon" />
							</div>
						</div>
						<div className="patient-chart-header-action-container d-flex gap-3 align-items-center">
							<button
								className="btn btn-primary mt-1 btn-md border-radius-button border-0 d-flex align-items-center gap-2"
								type="button"
								id="patient_chart_add_new_patient_btn_id"
								onClick={() => console.warn('Create New Patient workflow is not migrated yet.')}
							>
								<span className="mdi mdi-plus" />
								<span>Create New Patient</span>
							</button>
						</div>
					</div>
				</div>

				<Card>
					<DataTable
						value={patients}
						lazy
						paginator
						first={first}
						rows={rows}
						totalRecords={totalRecords}
						onPage={onPageChange}
						sortField={sortMeta.sortField}
						sortOrder={sortMeta.sortOrder}
						onSort={onSortChange}
						loading={loading}
						rowsPerPageOptions={[5, 10, 25, 50]}
						emptyMessage="No patients found."
						scrollable
						scrollHeight="65vh"
						className="p-datatable-striped active-patient-table"
						id="care_group_active_patients"
						tableClassName="table table-hover border w-100"
					>
						<Column field="sno" header="S.No" style={{ width: '70px' }} body={(row) => <div className="table-data">{row.sno}</div>} />
						<Column field="fullName" header="Name" sortable style={{ width: '180px' }} body={nameBodyTemplate} />
						<Column field="gender" header="Gender" sortable style={{ width: '100px' }} body={(row) => <div className="table-data">{row.gender}</div>} />
						<Column field="dob" header="Date of Birth" sortable style={{ width: '120px' }} body={(row) => <div className="table-data">{row.dob}</div>} />
						<Column header="Phone Number" style={{ width: '200px' }} body={phoneBodyTemplate} />
						<Column field="emrId" header="EMR Id" sortable style={{ width: '120px' }} body={(row) => <div className="table-data text-uppercase">{row.emrId}</div>} />
						<Column field="medicareNumber" header="Medicare Number" style={{ width: '150px' }} body={(row) => <div className="table-data text-uppercase">{row.medicareNumber}</div>} />
						<Column header="Action" style={{ width: '100px' }} body={() => <span className="mdi mdi-dots-vertical action-group-icon" />} />
					</DataTable>
				</Card>
			</div>
		</div>
	);
};

export default ActivePatientsList;
