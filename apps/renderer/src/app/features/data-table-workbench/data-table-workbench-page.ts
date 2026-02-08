import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';

type DemoRow = {
  id: number;
  name: string;
  category: 'platform' | 'ui' | 'ops';
  status: 'healthy' | 'warning' | 'error';
  owner: string;
};

const DATA: DemoRow[] = [
  {
    id: 1,
    name: 'Desktop Main',
    category: 'platform',
    status: 'healthy',
    owner: 'Platform',
  },
  {
    id: 2,
    name: 'Renderer Shell',
    category: 'ui',
    status: 'healthy',
    owner: 'Frontend',
  },
  {
    id: 3,
    name: 'Storage Gateway',
    category: 'platform',
    status: 'warning',
    owner: 'Platform',
  },
  {
    id: 4,
    name: 'Release Pipeline',
    category: 'ops',
    status: 'healthy',
    owner: 'DevEx',
  },
  {
    id: 5,
    name: 'Telemetry Console',
    category: 'ui',
    status: 'warning',
    owner: 'Frontend',
  },
  {
    id: 6,
    name: 'Update Service',
    category: 'platform',
    status: 'error',
    owner: 'Platform',
  },
  {
    id: 7,
    name: 'License Audit',
    category: 'ops',
    status: 'healthy',
    owner: 'DevEx',
  },
  {
    id: 8,
    name: 'A11y Checks',
    category: 'ops',
    status: 'healthy',
    owner: 'QA',
  },
  {
    id: 9,
    name: 'Carbon Adapter',
    category: 'ui',
    status: 'healthy',
    owner: 'Frontend',
  },
  {
    id: 10,
    name: 'API Gateway',
    category: 'platform',
    status: 'warning',
    owner: 'Platform',
  },
];

@Component({
  selector: 'app-data-table-workbench-page',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
  ],
  templateUrl: './data-table-workbench-page.html',
  styleUrl: './data-table-workbench-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableWorkbenchPage implements AfterViewInit {
  readonly displayedColumns = ['id', 'name', 'category', 'status', 'owner'];
  readonly dataSource = new MatTableDataSource<DemoRow>(DATA);
  filterText = '';

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  constructor() {
    this.dataSource.filterPredicate = (row, filter) => {
      const value =
        `${row.name} ${row.category} ${row.status} ${row.owner}`.toLowerCase();
      return value.includes(filter);
    };
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
  }

  applyFilter(value: string) {
    this.filterText = value;
    this.dataSource.filter = value.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
}
