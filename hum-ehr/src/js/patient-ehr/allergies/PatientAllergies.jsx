import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar } from 'primereact/sidebar';
import PatientAllergiesList from './PatientAllergiesList';
import PatientAllergiesAddEdit from './PatientAllergiesAddEdit';
import PatientAllergyLookupInput from './PatientAllergyLookupInput';
import { fetchAllergyMetadata } from '../../../services/lookupService';
import './PatientAllergies.css';

const EMPTY_FILTERS = {
	allergyType: '',
	subType: '',
	subTypeCode: '',
	reaction: '',
	reactionCode: '',
	severity: '',
};

const EMPTY_LOOKUPS = {
	allergyTypes: [],
	severities: [],
	criticalities: [],
	verificationStatuses: [],
	clinicalStatuses: [],
};

const normalizeHumCodeList = (items) => {
	if (!items) return [];
	if (Array.isArray(items)) return items.map((item) => ({
		...item,
		code: item.code,
		description: item.description || item.conceptName || item.name || item.code,
	}));
	return Object.keys(items).map((key) => ({
		...items[key],
		code: items[key]?.code || key,
		description: items[key]?.description || items[key]?.conceptName || items[key]?.name || key,
	}));
};

const PatientAllergies = ({ patientId }) => {
	const [viewMode, setViewMode] = useState('LIST');
	const [recordType, setRecordType] = useState('active');
	const [showDeleted, setShowDeleted] = useState(false);
	const [filterVisible, setFilterVisible] = useState(false);
	const [selectedRecord, setSelectedRecord] = useState(null);
	const [actionType, setActionType] = useState('create');
	const [searchTerm, setSearchTerm] = useState('');
	const [refreshKey, setRefreshKey] = useState(0);
	const [lookups, setLookups] = useState(EMPTY_LOOKUPS);
	const [filterForm, setFilterForm] = useState(EMPTY_FILTERS);
	const [metadataLoading, setMetadataLoading] = useState(false);

	const isNkaOrNkdaFilter = useMemo(() => ['NKA', 'NKDA'].includes(filterForm.allergyType), [filterForm.allergyType]);

	useEffect(() => {
		let ignore = false;
		const loadAllergyMetadata = async () => {
			setMetadataLoading(true);
			try {
				const metadata = await fetchAllergyMetadata();
				if (ignore) return;
				const payload = {
					allergyTypes: normalizeHumCodeList(metadata.types),
					severities: metadata.severities || [],
					criticalities: metadata.criticalities || [],
					verificationStatuses: metadata.verificationStatuses || [],
					clinicalStatuses: normalizeHumCodeList(metadata.clinicalStatuses),
				};
				setLookups(payload);
				window.patientCache = window.patientCache || {};
				window.patientCache[`allergyMetadata_${patientId}`] = payload;
			} catch (error) {
				console.error('Failed to load allergy metadata.', error);
			} finally {
				if (!ignore) setMetadataLoading(false);
			}
		};

		loadAllergyMetadata();
		return () => { ignore = true; };
	}, [patientId]);

	const openAddEdit = useCallback((record = null, action = 'create') => {
		setSelectedRecord(record);
		setActionType(action);
		setViewMode('ADD_EDIT');
	}, []);

	const closeAddEdit = useCallback((shouldRefresh = false) => {
		setViewMode('LIST');
		setSelectedRecord(null);
		setActionType('create');
		if (shouldRefresh) setRefreshKey((key) => key + 1);
	}, []);

	const updateFilter = (key, value) => {
		setFilterForm((previous) => {
			const nextValue = { ...previous, [key]: value };
			if (key === 'allergyType' && ['NKA', 'NKDA'].includes(value)) {
				nextValue.subType = '';
				nextValue.subTypeCode = '';
				nextValue.reaction = '';
				nextValue.reactionCode = '';
				nextValue.severity = '';
			}
			return nextValue;
		});
	};

	const handleResetFilters = () => {
		setFilterForm(EMPTY_FILTERS);
		setRefreshKey((key) => key + 1);
	};

	const handleApplyFilters = () => {
		setFilterVisible(false);
		setRefreshKey((key) => key + 1);
	};

	const handleRecordTypeChange = (type) => {
		setRecordType(type);
		setShowDeleted(false);
	};

	return (
		<div className="pa-allergies-main-container" id={`patient_allergies_hub_${patientId}`}>
			{viewMode === 'LIST' ? (
				<div className="pa-allergies-list-main-container">
					<div className="pa-allergies-main-header container-fluid p-0 my-2">
						<div className="pa-allergies-header-input-container d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
							<div className="pa-allergies-header-input-group d-flex align-items-center gap-2 flex-wrap">
								<div className="active-history-toggle-group">
									<ul className="nav nav-pills active-history-toggle-group-list toggle-group-small" role="tablist">
										<li className="nav-item">
											<button className={`nav-link small ${recordType === 'active' ? 'active' : ''}`} onClick={() => handleRecordTypeChange('active')} type="button">Active</button>
										</li>
										<li className="nav-item">
											<button className={`nav-link small ${recordType === 'history' ? 'active' : ''}`} onClick={() => handleRecordTypeChange('history')} type="button">History</button>
										</li>
									</ul>
								</div>

								{recordType === 'history' && (
									<div className="pa-allergy-header-recover-delete-record-group form-check ms-2">
										<input
											type="checkbox"
											id={`pa_allergy_recover_deleted_deleted_input_checkbox_${patientId}`}
											className="form-check-input pa_allergy_recover_deleted_deleted_input_checkbox"
											checked={showDeleted}
											onChange={(event) => setShowDeleted(event.target.checked)}
										/>
										<label className="form-check-label pa_allergy_recover_deleted_deleted_input_checkbox_label" htmlFor={`pa_allergy_recover_deleted_deleted_input_checkbox_${patientId}`}>
											Show Deleted Records
										</label>
									</div>
								)}

								<div className="pa-allergies-header-search-input-group position-relative ms-2">
									<input
										id="pa_search_allergy_input"
										type="text"
										className="form-control pa-search-allergy-input"
										placeholder="Search allergies"
										value={searchTerm}
										onChange={(event) => setSearchTerm(event.target.value)}
									/>
									<i className="fa fa-solid fa-magnifying-glass position-absolute end-0 top-50 translate-middle-y me-2 text-muted" />
								</div>
							</div>

							<div className="pa-allergies-header-action-icons-container d-flex align-items-center gap-2">
								<button type="button" className="pa-allegy-header-filter-icon-container btn pa-allergy-filter-icon-btn d-flex align-items-center gap-2 btn-md border-0" onClick={() => setFilterVisible(true)}>
									<span className="mdi mdi-filter-variant pa-allergy-filter-icon" />Filter
								</button>
								{recordType !== 'history' && (
									<button type="button" className="pa-add-new-allergy-btn btn btn-primary btn-md border-radius-button text-nowrap" id="pa_add_new_allergy_btn" onClick={() => openAddEdit(null, 'create')}>
										<span className="mdi mdi-plus" /> Add Allergy
									</button>
								)}
							</div>
						</div>
					</div>

					{metadataLoading && <div className="small text-muted mb-2">Loading allergy master data...</div>}

					<div className="pa-allergies-list-body">
						<PatientAllergiesList
							patientId={patientId}
							recordType={recordType}
							showDeleted={showDeleted}
							searchTerm={searchTerm}
							advancedFilters={filterForm}
							lookups={lookups}
							refreshKey={refreshKey}
							onEdit={(record) => openAddEdit(record, 'edit')}
							onRecoverEdit={(record) => openAddEdit(record, 'recover')}
							onRefresh={() => setRefreshKey((key) => key + 1)}
						/>
					</div>
				</div>
			) : (
				<div className="pa-allergies-add-edit-main-container">
					<PatientAllergiesAddEdit
						patientId={patientId}
						allergyRecord={selectedRecord}
						actionType={actionType}
						recordType={recordType}
						lookups={lookups}
						onClose={closeAddEdit}
					/>
				</div>
			)}

			<Sidebar
				visible={filterVisible}
				position="right"
				onHide={() => setFilterVisible(false)}
				className="pa-allergy-header-offcanvas-container offcanvas offcanvas-end"
				id={`pa_allergy_filter_acute_chronic_options_${patientId}`}
				header={<h5>Allergy Filters</h5>}
			>
				<form id="pa_allergy_filter_multiple_options_form_id" className="ignore-auto-save" onSubmit={(event) => { event.preventDefault(); handleApplyFilters(); }}>
					<div className="form-group mb-3">
						<label htmlFor="pa_allergy_section_allergy_intolerance_type_options" className="form-label">Allergy Type</label>
						<select
							id="pa_allergy_section_allergy_intolerance_type_options"
							className="form-select form-select-sm"
							value={filterForm.allergyType}
							onChange={(event) => updateFilter('allergyType', event.target.value)}
						>
							<option value="">Select Type</option>
							{lookups.allergyTypes.map((type) => <option key={type.code} value={type.code}>{type.description}</option>)}
						</select>
					</div>

					<div className="mt-3 form-group pc-search-input-container">
						<PatientAllergyLookupInput
							id="pa_allergy_section_allergen_type"
							label="Allergy Subtype"
							conceptCategory="ALST"
							value={filterForm.subType}
							disabled={isNkaOrNkdaFilter}
							onChange={(value) => setFilterForm((previous) => ({ ...previous, subType: value, subTypeCode: '' }))}
							onSelect={(selected) => setFilterForm((previous) => ({ ...previous, subType: selected.value, subTypeCode: selected.code }))}
						/>
					</div>

					<div className="mt-3 form-group pc-search-input-container">
						<PatientAllergyLookupInput
							id="pa_allergy_section_allergen_reaction"
							label="Reaction"
							conceptCategory="ALRE"
							value={filterForm.reaction}
							disabled={isNkaOrNkdaFilter}
							onChange={(value) => setFilterForm((previous) => ({ ...previous, reaction: value, reactionCode: '' }))}
							onSelect={(selected) => setFilterForm((previous) => ({ ...previous, reaction: selected.value, reactionCode: selected.code }))}
						/>
					</div>

					<div className="mt-3 form-group">
						<label htmlFor="pa_allergy_section_severity_type_options" className="form-label">Severity</label>
						<select
							id="pa_allergy_section_severity_type_options"
							className="form-select form-select-sm"
							value={filterForm.severity}
							disabled={isNkaOrNkdaFilter}
							onChange={(event) => updateFilter('severity', event.target.value)}
						>
							<option value="">Select Severity</option>
							{lookups.severities.map((severity) => <option key={severity.id} value={severity.id}>{severity.conceptName}</option>)}
						</select>
					</div>

					<div className="pp-reset-apply-button-group mt-4 form-group d-flex justify-content-between">
						<button type="button" className="btn btn-outline-secondary border-radius-button reset bs-offcanvas-reset-btn" onClick={handleResetFilters}>Reset</button>
						<button type="submit" className="btn btn-primary border-radius-button apply bs-offcanvas-apply-btn" style={{ width: 120 }}>Apply</button>
					</div>
				</form>
			</Sidebar>
		</div>
	);
};

export default PatientAllergies;
