// Arquivo só de tipos: consumido por Server e Client Components, então não leva
// `'use server'` (que transformaria cada export em endpoint público) nem
// `server-only` (que impediria o import no cliente).

export type FormState = {
    message?: string[]
    emptyFields?: string[]
    values?: Record<string, string>[]
}

export type CredentialsType = {
    email: string | unknown,
    password: string | unknown,
    //callbackUrl: string | unknown
}

export type Info = {
    message?: string[],
    erro?: string,
    name?: string,
    borndate?: string,
    idfide?: number | null,
    idcbx?: number | null,
    catname?: string,
    value?: number,
    key_code?: string,
    qr_code?: string,
    status?: string
}

export type NewTournment = {
    
    message?: string,
    emptyFields?: string[]
    values?: {
        title: string
    }
}

export type Player = {
  city: string
  club: string
  genre: boolean
  data_nasc: Date
  id_fide: number
  id_cbx: number
  uuid_cat: string
  status: string
  id_usuario: number
  uuid: string
  name: string
  id_division: number
  id_torneio: number
  rtg_fide: number
  rtg_cbx: number
  federation?: string
  titulo?: string
  categoria: {
    name: string
    uuid: string
    id_torneio: number
    min_y?: number
  }
  divisoes: {
    name: string,
    id: number
  }
  usuario: {
    id: number
    email: string,
  }
}

export type Cat = {
  uuid: string,
  name: string,
  default_division: number
}

export type Div = {
  id: number,
  name: string,
  isAbsolute: boolean
}

/** Categoria de um torneio como o formulário de inscrição precisa dela. */
export type TournamentCategory = {
  uuid: string
  name: string
  price: number
  minYear: number
  maxYear: number
  divisionId: number
}

/** Divisão de um torneio como o formulário de inscrição precisa dela. */
export type TournamentDivision = {
  id: number
  name: string
  genre: 'masculino' | 'feminino' | 'ambos'
  isAbsolute: boolean
}

//number

export type Differences = {
  city: string
  club: string
  genre: boolean
  data_nasc: Date
  id_fide: number
  id_cbx: number
  uuid_cat: string
  status: string
  id_usuario: number
  uuid: string
  name: string
  id_division: number
  id_torneio: number
  rtg_fide: number
  rtg_cbx: number
}

export type Tempo = {
  time: number
  plus: number
}

export type Tournment = {
  id: number
  title: string

  chave_pix: string | null

  date_event: Date
  date_inscri: Date

  local: string | null
  local_link: string | null

  link_chessresults: string | null

  time_analog: number | null
  time_digital: number | null

  tempo_torneio_time_analogTotempo: Tempo | null
  tempo_torneio_time_digitalTotempo: Tempo | null
}