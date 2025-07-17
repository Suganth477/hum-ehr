import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { APIUtility } from '../js/APIUtility';
import { 
  DataTable, 
  Column, 
  TabView, 
  TabPanel,
  Chip,
  Button,
  InputText,
  Dropdown,
  Calendar,
  Badge,
  Tooltip
} from 'primereact';
import { 
  Avatar,
  Card
} from 'primereact';
import { 
  FilterMatchMode, 
  FilterOperator 
} from 'primereact/api';
import { 
  Tag 
} from 'primereact/tag';
import { 
  Menubar 
} from 'primereact/menubar';
import { 
  SplitButton 
} from 'primereact/splitbutton';

const ActivePatientsList3 = ({ baseUrl, productCode }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filters, setFilters] = useState({
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
    searchColumn: 'PATIENNAME'
  });
  const [activePatientTabs, setActivePatientTabs] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();

  const loadFilterInputsWithValue = async () => {
    try {
      const [programs, facilities, physicians, clinicians, userDetails] = [[],[],[],[],[]];
      
      setFilters(prev => ({
        ...prev,
        productOptions: constructSubscribedProblemList(programs),
        facilityOptions: facilities,
        physicianOptions: physicians,
        clinicianOptions: clinicians
      }));
      
      window.history.replaceState(null, null, "?nav=");
      loadPatientChartNameList();
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadFilterInputsWithValue();
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [filters, first, rows]);

  const constructSubscribedProblemList = (programList) => {
    return programList.reduce((prevProgram, nextProgram) => {
      return [...prevProgram, 
        { value: nextProgram.code, label: nextProgram.name }
      ];
    }, [{ value: '', label: 'All' }]);
  };

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0aW5nX2FwaHltYW5pa2FuZGFuIiwidGltZW91dFNjcmVlbiI6IiIsInRpbWV6b25lIjoiVVMvRWFzdGVybiIsImlzV2ViTG9naW4iOiJZIiwidGltZW91dER1cmF0aW9uIjo2MC4wLCJ1c2VySWQiOjk0NTE0LCJsb2dnZWRJbkNsaW5pY2lhbklkIjotMSwibG9nZ2VkSW5QaHlzaWNpYW5JZCI6MTQ1MSwiYXVkIjoid2ViIiwiY2xpbmljaWFuQWRtaW5GbGFnIjoiTiIsImF1ZGl0TG9nVVVJRCI6IjMzNGI1ZGY3LTU0MjEtNDYzYy1iYmEwLTMwYWM2M2MxMmRkYy0yMDI0LTAzLTA1LTA3LTA3LTEwIiwicGh5c2ljaWFuQWRtaW5GbGFnIjoiWSIsInJvbGVDb2RlIjoiQ01TUEhZU0lDSSIsImlzVGltZW91dCI6Ik4iLCJjbGluaWNpYW5TdXBlcnZpc29yRmxhZyI6Ik4iLCJleHAiOjE3NTI3NDgwNTgsImlhdCI6MTc1MjY2MTY1ODUyMSwianRpIjoiMTAxZjMyMmQtYjE0Ni00YWFlLWEyNjAtMDZiNmMzYzcwMTc5In0._NNqy9SKJmzyhzhb3mZO4bl8KsF7FGKl1GzRnptnz1M';
      const response = await fetch(APIUtility.API_END_POINT_URL.allActivePatientDetails, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token 
        },
        body: JSON.stringify({
          draw: 1,
          length: rows,
          start: first,
          filter: {
            productCode: filters.productCode || "",
            facilityId: filters.facilityId,
            physicianId: filters.physicianId,
            clinicianId: filters.clinicianId,
            clinicianRoleStatus: filters.clinicianRoleStatus || "ALL",
            physicianRoleStatus: filters.physicianRoleStatus || "ALL",
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            programStatus: filters.programStatus,
          },
          order: {
            column: 'fullName',
            type: 'asc'
          },
          search: filters.search,
          searchColumn: filters.searchColumn
        })
      });
      
      const responseData = await response.json();
      if (responseData.status === "success") {
        setTotalRecords(responseData.recordsFiltered);
        const formattedPatients = responseData.data.map((patient, index) => ({
          id: patient.patientId,
          sno: index + 1,
          fullName: patient.fullName,
          gender: patient.genderDesc,
          dob: patient.dob,
          phone: formatPhoneNumber(patient),
          emrId: patient.emrId,
          medicareNumber: patient.medicareNumber || '',
          patientData: patient
        }));
        setPatients(formattedPatients);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (patient) => {
    const { mobilePhoneInvalidFlag, pagerPhoneInvalidFlag, workPhoneInvalidFlag, 
           mobilePhoneNumber, homePhoneNumber, workPhoneNumber } = patient;
    
    return (
      <div className="flex flex-column">
        {mobilePhoneNumber && (
          <span className={mobilePhoneInvalidFlag === "Y" ? 'text-red-500' : ''}>
            {mobilePhoneNumber} (MPH)
          </span>
        )}
        {homePhoneNumber && (
          <span className={pagerPhoneInvalidFlag === "Y" ? 'text-red-500' : ''}>
            {homePhoneNumber} (HPH)
          </span>
        )}
        {workPhoneNumber && (
          <span className={workPhoneInvalidFlag === "Y" ? 'text-red-500' : ''}>
            {workPhoneNumber} (WPH)
          </span>
        )}
      </div>
    );
  };

  const actionBodyTemplate = (rowData) => {
    const items = [
      {
        label: 'View Profile',
        icon: 'pi pi-user',
        command: () => displayPatientNameInNewTab(rowData.id, rowData.fullName)
      },
      {
        label: 'More Actions',
        icon: 'pi pi-ellipsis-v',
        items: [
          { label: 'Option 1', icon: 'pi pi-cog' },
          { label: 'Option 2', icon: 'pi pi-refresh' }
        ]
      }
    ];

    return (
      <SplitButton 
        label="Actions" 
        icon="pi pi-cog" 
        model={items} 
        className="p-button-sm"
        buttonClassName="p-button-text"
      />
    );
  };

  const nameBodyTemplate = (rowData) => {
    return (
      <Button 
        label={rowData.fullName} 
        className="p-button-text p-button-plain" 
        onClick={() => displayPatientNameInNewTab(rowData.id, rowData.fullName)}
      />
    );
  };

  const loadPatientChartNameList = () => {
    // Implementation remains the same
  };

  const handlePatientTabClick = (patientId) => {
    // Implementation remains the same
  };

  const updatePatientLocalStorageInformation = (patientId) => {
    // Implementation remains the same
  };

  const closePatientChart = (patientId, e) => {
    e.stopPropagation();
    // Implementation remains the same
  };

  const removePatientInformationFromLocalStorage = (patientId) => {
    // Implementation remains the same
  };

  const displayPatientNameInNewTab = (patientId, patientName) => {
    // Implementation remains the same
  };

  const handlePatientChartLocalStorageInformation = (patientId, patientName) => {
    // Implementation remains the same
  };

  const onPage = (event) => {
    setFirst(event.first);
    setRows(event.rows);
  };

  return (
    <div className="w-full">
      {/* Patient Tabs */}
      <Card className="mb-3">
        <Menubar
          model={[
            {
              label: 'Patient List',
              icon: 'pi pi-list',
              badge: totalRecords.toString(),
              command: () => setActiveIndex(0)
            },
            ...activePatientTabs.filter(tab => tab.isMainTab).map(tab => ({
              label: tab.name,
              icon: 'pi pi-user',
              template: (item) => (
                <div className="flex align-items-center">
                  <span>{item.label}</span>
                  <Button 
                    icon="pi pi-times" 
                    className="p-button-text p-button-sm p-button-rounded ml-2" 
                    onClick={(e) => closePatientChart(tab.id, e)}
                  />
                </div>
              ),
              command: () => handlePatientTabClick(tab.id)
            })),
            activePatientTabs.filter(tab => !tab.isMainTab).length > 0 && {
              label: 'More',
              icon: 'pi pi-ellipsis-h',
              badge: activePatientTabs.filter(tab => !tab.isMainTab).length.toString(),
              items: activePatientTabs.filter(tab => !tab.isMainTab).map(tab => ({
                label: tab.name,
                icon: 'pi pi-user',
                command: () => handlePatientTabClick(tab.id)
              }))
            }
          ].filter(Boolean)}
        />
      </Card>

      {/* Patient List */}
      <Card>
        <DataTable
          value={patients}
          lazy
          paginator
          first={first}
          rows={rows}
          totalRecords={totalRecords}
          onPage={onPage}
          loading={loading}
          rowsPerPageOptions={[5, 10, 25]}
          paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords} patients"
          emptyMessage="No patients found."
          scrollable
          scrollHeight="flex"
          className="p-datatable-striped"
        >
          <Column field="sno" header="S.No" style={{ width: '70px' }} />
          <Column field="fullName" header="Name" body={nameBodyTemplate} style={{ width: '180px' }} />
          <Column field="gender" header="Gender" style={{ width: '100px' }} />
          <Column field="dob" header="Date of Birth" style={{ width: '120px' }} />
          <Column field="phone" header="Phone Number" style={{ width: '200px' }} />
          <Column field="emrId" header="EMR Id" style={{ width: '120px' }} />
          <Column field="medicareNumber" header="Medicare Number" style={{ width: '150px' }} />
          <Column body={actionBodyTemplate} header="Actions" style={{ width: '100px' }} />
        </DataTable>
      </Card>

      {/* Patient Chart Containers */}
      <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
        <TabPanel header="Patient List">
          {/* Content for patient list tab */}
        </TabPanel>
        
        {activePatientTabs.map(tab => (
          <TabPanel 
            key={tab.id} 
            header={
              <div className="flex align-items-center">
                <span>{tab.name}</span>
                <Button 
                  icon="pi pi-times" 
                  className="p-button-text p-button-sm p-button-rounded ml-2" 
                  onClick={(e) => closePatientChart(tab.id, e)}
                />
              </div>
            }
          >
            <Card>
              <div className="text-xl font-bold">Patient Chart for {tab.name}</div>
              {/* PatientChart component would go here */}
            </Card>
          </TabPanel>
        ))}
      </TabView>
    </div>
  );
};

export default ActivePatientsList3;