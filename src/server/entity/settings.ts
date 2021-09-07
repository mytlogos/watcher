import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { DBEntity, Project } from "./project";

@Entity()
export class RemoteSetting extends DBEntity {
  @Column({ nullable: true })
  projectId?: number;

  @OneToOne(() => Project)
  @JoinColumn()
  project?: Project;

  @Column()
  name: string;

  @Column()
  host: string;

  @Column()
  username: string;

  @Column()
  token: string;

  @Column()
  priority: number;

  constructor() {
    super();
    this.name = "";
    this.host = "";
    this.username = "";
    this.token = "";
    this.priority = 0;
  }
}
