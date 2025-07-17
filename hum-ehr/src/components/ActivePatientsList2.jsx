import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { TabView, TabPanel } from 'primereact/tabview';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { APIUtility } from '../js/APIUtility';

const ActivePatientsList2 = ({ baseUrl, productCode }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);
  const [rowCount, setRowCount] = useState(0);
  const [globalFilter, setGlobalFilter] = useState('');
  const [activePatientTabs, setActivePatientTabs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadPatientChartNameList();
    fetchPatients();
  }, [first, rows, globalFilter]);

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
          search: globalFilter,
          searchColumn: 'PATIENNAME',
        })
      });

      const data = await response.json();
      if (data.status === "success") {
        setRowCount(data.recordsFiltered);
        const formattedPatients = data.data.map((patient, index) => ({
          id: patient.patientId,
          sno: index + 1 + first,
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPatientChartNameList = () => {
    // ... same implementation
  };
  
  const formatPhoneNumber = (p) => {
    return [p.mobilePhoneNumber, p.homePhoneNumber, p.workPhoneNumber]
      .filter(Boolean)
      .join(', ');
  };

  const displayPatientNameInNewTab = (id, name) => {
    // Your logic here
  };

  const actionTemplate = (rowData) => (
    <div className="flex gap-2">
      <Button icon="pi pi-user" className="p-button-text" onClick={() => displayPatientNameInNewTab(rowData.id, rowData.fullName)} />
      <Button icon="pi pi-ellipsis-v" className="p-button-text" />
    </div>
  );

  const header = (
    <div className="flex justify-between items-center">
      <span className="p-input-icon-left">
        <i className="pi pi-search" />
        <InputText
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search by name..."
        />
      </span>
      <Tag value={`Total: ${rowCount}`} severity="info" />
    </div>
  );

  return (
    <div className="p-4">
      <TabView>
        <TabPanel header={`Patient List (${rowCount})`} key="patient_list">
          <Card className="mt-2">
            <DataTable
              value={patients}
              lazy
              paginator
              rows={rows}
              totalRecords={rowCount}
              first={first}
              onPage={(e) => {
                setFirst(e.first);
                setRows(e.rows);
              }}
              loading={loading}
              header={header}
              globalFilterFields={['fullName']}
            >
              <Column field="sno" header="S.No" style={{ width: '80px' }} />
              <Column field="fullName" header="Name" body={(row) => (
                <span className="text-blue-600 cursor-pointer" onClick={() => displayPatientNameInNewTab(row.id, row.fullName)}>
                  {row.fullName}
                </span>
              )} />
              <Column field="gender" header="Gender" />
              <Column field="dob" header="Date of Birth" />
              <Column field="phone" header="Phone Number" />
              <Column field="emrId" header="EMR ID" />
              <Column field="medicareNumber" header="Medicare Number" />
              <Column header="Actions" body={actionTemplate} style={{ width: '120px' }} />
            </DataTable>
          </Card>
        </TabPanel>

        {activePatientTabs.map(tab => (
          <TabPanel key={tab.id} header={tab.name}>
            <Card>
              <h5>Patient Chart for {tab.name}</h5>
              {/* Your PatientChart goes here */}
            </Card>
          </TabPanel>
        ))}
      </TabView>
    </div>
  );
};

export default ActivePatientsList2;
