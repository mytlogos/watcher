import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

class DBEntity {
  @PrimaryGeneratedColumn()
  id!: number;
}

@Entity()
export class ProjectMeta extends DBEntity {
  @Column({ type: "datetime" })
  lastRun?: Date;

  @OneToMany(() => Dependency, (dependeny) => dependeny.projectMeta, {
    cascade: true,
    eager: true,
  })
  dependencies?: Dependency[];
}

@Entity()
export class Dependency extends DBEntity {
  @ManyToOne(() => ProjectMeta, (meta) => meta.dependencies)
  projectMeta!: ProjectMeta;

  @Column()
  name!: string;

  @Column()
  currentVersion!: string;

  @Column()
  availableVersions!: string;

  @Column()
  data!: string;

  constructor() {
    super();
    this.data = "";
    this.availableVersions = "";
    this.currentVersion = "";
    this.name = "";
  }
}

@Entity()
export class Project extends DBEntity {
  @Column()
  path: string;
  @Column()
  type: string;
  @Column()
  name: string;
  @Column()
  isGlobal: boolean;
  @OneToOne(() => ProjectMeta, { eager: true, cascade: true })
  @JoinColumn()
  meta?: ProjectMeta;

  constructor() {
    super();
    this.path = "";
    this.type = "";
    this.name = "";
    this.isGlobal = false;
    this.meta = undefined;
  }
}
