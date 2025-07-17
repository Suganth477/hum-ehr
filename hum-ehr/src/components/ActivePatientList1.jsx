import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { APIUtility } from '../js/APIUtility';

const ActivePatientsList1 = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageCount, setPageCount] = useState(0);
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
  });
  const [search, setSearch] = useState('');
  const [searchColumn, setSearchColumn] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState([]);

  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(APIUtility.API_END_POINT_URL.allActivePatientDetails, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0aW5nX2FwaHltYW5pa2FuZGFuIiwidGltZW91dFNjcmVlbiI6IiIsInRpbWV6b25lIjoiVVMvRWFzdGVybiIsImlzV2ViTG9naW4iOiJZIiwidGltZW91dER1cmF0aW9uIjo2MC4wLCJ1c2VySWQiOjk0NTE0LCJsb2dnZWRJbkNsaW5pY2lhbklkIjotMSwibG9nZ2VkSW5QaHlzaWNpYW5JZCI6MTQ1MSwiYXVkIjoid2ViIiwiY2xpbmljaWFuQWRtaW5GbGFnIjoiTiIsImF1ZGl0TG9nVVVJRCI6IjMzNGI1ZGY3LTU0MjEtNDYzYy1iYmEwLTMwYWM2M2MxMmRkYy0yMDI0LTAzLTA1LTA3LTA3LTEwIiwicGh5c2ljaWFuQWRtaW5GbGFnIjoiWSIsInJvbGVDb2RlIjoiQ01TUEhZU0lDSSIsImlzVGltZW91dCI6Ik4iLCJjbGluaWNpYW5TdXBlcnZpc29yRmxhZyI6Ik4iLCJleHAiOjE3NTI3NDgwNTgsImlhdCI6MTc1MjY2MTY1ODUyMSwianRpIjoiMTAxZjMyMmQtYjE0Ni00YWFlLWEyNjAtMDZiNmMzYzcwMTc5In0._NNqy9SKJmzyhzhb3mZO4bl8KsF7FGKl1GzRnptnz1M'
        },
        body: JSON.stringify({
          draw: pagination.pageIndex,
          length: pagination.pageSize,
          start: pagination.pageIndex * pagination.pageSize,
          filter: filters,
          order: sorting.length > 0 ? {
            column: sorting[0].id,
            type: sorting[0].desc ? 'desc' : 'asc'
          } : {column:'0',
            type:'asc'
          }
        })
      });

      const json = await response.json();

      if (json.status === "success") {
        setData(json.data.map(item => ({
          ...item,
          fullName: displayPatientNameWithLink(item),
          phone: displayPatientPhoneNumber(item),
          action: displayAllPossibleActionIcons()
        })));
        setPageCount(Math.ceil(json.recordsFiltered / pagination.pageSize));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, sorting, pagination, search, searchColumn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const displayAllPossibleActionIcons = () => (
    <span className="mdi mdi-dots-vertical action-group-icon"></span>
  );

  const displayPatientNameWithLink = (patientInfo) => {
    const { patientId, fullName } = patientInfo;
    return (
      <div 
        className="text-capitalize table-data active-patient-name-link pl-lg pull-left" 
        title="Patient Profile"
        data-toggle="tooltip" 
        data-patient-id={patientId}
        onClick={() => handlePatientClick(patientId, fullName)}
      >
        {fullName}
      </div>
    );
  };

  const displayPatientPhoneNumber = (patientInfo) => {
    const {
      mobilePhoneInvalidFlag, pagerPhoneInvalidFlag, workPhoneInvalidFlag, 
      mobilePhoneNumber, homePhoneNumber, workPhoneNumber, patientId 
    } = patientInfo;

    return (
      <div className="table-data">
        <span className={mobilePhoneInvalidFlag === "Y" ? 'invalid-number' : ''}>
          {mobilePhoneNumber ? `${mobilePhoneNumber} (MPH)` : ''}<br />
        </span>
        <span className={pagerPhoneInvalidFlag === "Y" ? 'invalid-number' : ''}>
          {homePhoneNumber ? `${homePhoneNumber} (HPH)` : ''}<br />
        </span>
        <span className={workPhoneInvalidFlag === "Y" ? 'invalid-number' : ''}>
          {workPhoneNumber ? `${workPhoneNumber} (WPH)` : ''}
        </span>
      </div>
    );
  };

  const handlePatientClick = (patientId, patientName) => {
    navigate(`/patient/${patientId}`);
    handlePatientChartLocalStorageInformation(patientId, patientName);
  };

  const handlePatientChartLocalStorageInformation = (patientId, patientName) => {
    // Stub: Save patient data to sessionStorage/localStorage if needed
  };

  const columns = useMemo(() => [
    {
      header: '#',
      accessorKey: 'sno',
      cell: info => <div className="table-data">{info.getValue()}</div>,
    },
    {
      header: 'Name',
      accessorKey: 'fullName',
      cell: info => info.getValue(),
    },
    {
      header: 'Gender',
      accessorKey: 'genderDesc',
      cell: info => <div className="table-data">{info.getValue()}</div>,
    },
    {
      header: 'DOB',
      accessorKey: 'dob',
      cell: info => <div className="table-data">{info.getValue()}</div>,
    },
    {
      header: 'Phone',
      accessorKey: 'phone',
      cell: info => info.getValue(),
    },
    {
      header: 'EMR ID',
      accessorKey: 'emrId',
      cell: info => <div className="table-data text-uppercase">{info.getValue()}</div>,
    },
    {
      header: 'Medicare',
      accessorKey: 'medicareNumber',
      cell: info => <div className="table-data text-uppercase">{info.getValue() || ''}</div>,
    },
    {
      header: 'Actions',
      accessorKey: 'action',
      cell: info => info.getValue(),
    }
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: {
      pagination,
      sorting,
      globalFilter: search
    },
    pageCount,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="container-fluid">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Active Patients</h3>
          <div className="card-tools">
            <button className="btn btn-tool" onClick={() => setSearch('')}>
              <i className="fas fa-filter"></i> Clear Filters
            </button>
          </div>
        </div>

        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row">
            <div className="col-md-6">
              <div>
                Showing {pagination.pageIndex * pagination.pageSize + 1} to{' '}
                {Math.min((pagination.pageIndex + 1) * pagination.pageSize, pageCount * pagination.pageSize)}{' '}
                of {pageCount * pagination.pageSize} entries
              </div>
            </div>
            <div className="col-md-6 text-right">
              <button
                className="btn btn-primary mr-2"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </button>
              <button
                className="btn btn-primary"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivePatientsList1;