'use client'

import { useActionState, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TournamentContext } from '@/lib/context'
import PlayerFields from './player-fields'
import { selectCategory } from './select-category'
import { submitInscription } from './submit-inscription'
import type {
  CategoryStatus,
  Genre,
  InscriptionState,
  LookupResult,
  OfficialPlayer,
} from './types'
import { formatCurrency, handleEnterBlur } from './utils'
import { verifyCbxId, verifyFideId } from './verify-player'

type IdKind = 'fide' | 'cbx'

type IdState = {
  value: string
  /** ID que foi conferido com sucesso nos site oficial. */
  verifiedId: string
  player: OfficialPlayer | null
  error: string
}

const emptyIdState: IdState = { value: '', verifiedId: '', player: null, error: '' }

const idRules: Record<
  IdKind,
  { label: string; isValid: (id: string) => boolean; lookup: (id: string) => Promise<LookupResult> }
> = {
  fide: {
    label: 'FIDE',
    isValid: (id) => id.length === 7 || id.length === 8,
    lookup: verifyFideId,
  },
  cbx: {
    label: 'CBX',
    isValid: (id) => id.length >= 4 && id.length <= 6,
    lookup: verifyCbxId,
  },
}

const initialState: InscriptionState = { status: 'idle' }
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png']

export default function InscriptionForm() {
  const tournament = useContext(TournamentContext)
  const router = useRouter()

  const [state, formAction] = useActionState(submitInscription, initialState)

  // ---- Identificação (ID FIDE / CBX) ----
  const [hasIds, setHasIds] = useState(true)
  const [fide, setFide] = useState<IdState>(emptyIdState)
  const [cbx, setCbx] = useState<IdState>(emptyIdState)
  // Cada consulta recebe um número; respostas de consultas antigas são descartadas.
  const lookupTickets = useRef<Record<IdKind, number>>({ fide: 0, cbx: 0 })

  // ---- Dados do jogador ----
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [genre, setGenre] = useState<Genre>('masc')
  const [identityTouched, setIdentityTouched] = useState(false)
  const [divisionChoice, setDivisionChoice] = useState<'default' | 'absolute'>('default')
  const [receiptName, setReceiptName] = useState('')
  const receiptInput = useRef<HTMLInputElement | null>(null)

  const playerFide = hasIds ? fide.player : null
  const playerCbx = hasIds ? cbx.player : null

  function handleIdChange(kind: IdKind, value: string) {
    const digits = value.replace(/\D/g, '')
    const update = kind === 'fide' ? setFide : setCbx

    update((current) =>
      digits === current.verifiedId
        ? { ...current, value: digits }
        : { value: digits, verifiedId: '', player: null, error: '' }
    )
  }

  async function checkId(kind: IdKind) {
    const rule = idRules[kind]
    const current = kind === 'fide' ? fide : cbx
    const update = kind === 'fide' ? setFide : setCbx
    const id = current.value.trim()

    if (id === '' || current.verifiedId === id) return

    if (!rule.isValid(id)) {
      update((latest) => ({ ...latest, verifiedId: '', player: null, error: '*Insira um ID válido' }))
      return
    }

    const ticket = ++lookupTickets.current[kind]
    update((latest) => ({ ...latest, verifiedId: '', player: null, error: '' }))

    let result: LookupResult

    try {
      result = await rule.lookup(id)
    } catch {
      // Falha de transporte (função na Vercel interrompida, sem rede...) não pode
      // deixar o formulário travado: vira um aviso e o jogador pode tentar de novo.
      result = { status: 'unavailable' }
    }

    if (ticket !== lookupTickets.current[kind]) return

    update((latest) => {
      // O jogador já mudou o campo enquanto a consulta acontecia.
      if (latest.value.trim() !== id) return latest

      if (result.status === 'found') {
        return { ...latest, verifiedId: id, player: result.player, error: '' }
      }

      return {
        ...latest,
        verifiedId: '',
        player: null,
        error:
          result.status === 'not-found'
            ? `*Usuário ${rule.label} não encontrado`
            : `*Não foi possível consultar a ${rule.label} agora. Tente novamente.`,
      }
    })
  }

  const idsBlocked = hasIds && (!playerFide || !playerCbx || fide.error !== '' || cbx.error !== '')

  // ---- Conferência do nome / data / gênero com os dados oficiais ----
  const nameError = useMemo(() => {
    if (!playerCbx || !identityTouched) return ''
    if (name.trim() === '' || name.trim() === playerCbx.name.trim()) return ''

    return `*Nome incorreto, o nome fornecido no ID é: ${playerCbx.name}`
  }, [playerCbx, name, identityTouched])

  const infoError = useMemo(() => {
    if (!playerFide || !playerCbx || !identityTouched) return ''

    const dateMismatch = birthDate.trim() !== '' && birthDate.trim() !== playerCbx.bornYear.trim()
    const genreMismatch =
      playerFide.genre !== null && playerFide.genre !== (genre === 'masc' ? 'm' : 'f')

    if (!dateMismatch && !genreMismatch) return ''

    return `*Informações inválidas, as informações cadastradas são: ${playerCbx.bornYear} - ${
      playerFide.genre === 'm' ? 'Masculino' : 'Feminino'
    }`
  }, [playerFide, playerCbx, birthDate, genre, identityTouched])

  // ---- Categoria (definida pela data de nascimento e pelo gênero) ----
  // As categorias e divisões chegam prontas do servidor junto com o torneio,
  // então a escolha é uma conta local: aparece na hora, sem consulta ao servidor.
  const dateComplete = birthDate.trim().length === 10

  const categoryResult = useMemo(
    () =>
      dateComplete
        ? selectCategory(tournament.categories ?? [], tournament.divisions ?? [], birthDate, genre)
        : null,
    [dateComplete, tournament.categories, tournament.divisions, birthDate, genre]
  )

  const categoryStatus: CategoryStatus = categoryResult === null ? 'idle' : categoryResult.status
  const category = categoryResult?.status === 'found' ? categoryResult.category : null
  const price = category?.price ?? 0

  // ---- Envio ----
  const fieldsComplete = name.trim() !== '' && dateComplete
  const identityOk = !hasIds || (nameError === '' && infoError === '')
  const canSubmit = price !== 0 && fieldsComplete && identityOk && receiptName !== ''
  const showCategory =
    dateComplete && categoryStatus === 'found' && (!hasIds || infoError === '')

  useEffect(() => {
    if (state.status === 'success') router.replace('/minhas-inscricoes')
  }, [state.status, router])

  function handleReceiptChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]

    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    const allowed = ALLOWED_EXTENSIONS.includes(extension)

    if (!allowed) event.currentTarget.value = ''

    setReceiptName(allowed ? file.name : '')
  }

  async function copyPixKey() {
    try {
      await navigator.clipboard.writeText(String(tournament.pixKey))
      alert('Copiado para área de transferência...')
    } catch {
      // Navegador sem permissão de área de transferência: o código continua visível na tela.
    }
  }

  return (
    <div className="form">
      <form
        action={formAction}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault()
        }}
      >
        <div style={{ width: '100%' }} className="select-radios">
          <div>
            <input
              className="division-for"
              id="possui-ids"
              type="radio"
              name="hasFide"
              value="true"
              checked={hasIds}
              onChange={() => setHasIds(true)}
            />
            <label htmlFor="possui-ids">Possuo ID FIDE e ID CBX</label>
          </div>
          <div>
            <input
              className="division-for"
              id="nao-possui-ids"
              type="radio"
              name="hasFide"
              value="false"
              checked={!hasIds}
              onChange={() => setHasIds(false)}
            />
            <label htmlFor="nao-possui-ids">Não possuo ID FIDE e ID CBX</label>
            <p className="obs obs-fide">*Se não possuir cadastro FIDE, selecione esta opção</p>
          </div>
        </div>

        {hasIds ? (
          <>
            <div style={{ width: 'calc(50% - 15px)' }}>
              <label htmlFor="form-fide">ID Fide: <p className="ast">*</p></label>
              <input
                id="form-fide"
                type="text"
                name="idfide"
                value={fide.value}
                maxLength={8}
                inputMode="numeric"
                onChange={(event) => handleIdChange('fide', event.currentTarget.value)}
                onBlur={() => checkId('fide')}
                onKeyDown={handleEnterBlur}
              />
              {fide.error !== '' ? <p className="error">{fide.error}</p> : ''}
            </div>
            <input
              type="text"
              hidden
              name="playerFide"
              value={playerFide ? JSON.stringify(playerFide) : ''}
              readOnly
            />

            <div style={{ width: 'calc(50% - 15px)' }}>
              <label htmlFor="form-cbx">ID CBX:<p className="ast">*</p></label>
              <input
                id="form-cbx"
                type="text"
                name="idcbx"
                value={cbx.value}
                maxLength={8}
                inputMode="numeric"
                onChange={(event) => handleIdChange('cbx', event.currentTarget.value)}
                onBlur={() => checkId('cbx')}
                onKeyDown={handleEnterBlur}
              />
              {cbx.error !== '' ? <p className="error">{cbx.error}</p> : ''}
            </div>
            <input
              type="text"
              hidden
              name="playerCbx"
              value={playerCbx ? JSON.stringify(playerCbx) : ''}
              readOnly
            />
          </>
        ) : (
          ''
        )}

        {idsBlocked ? <p className="error">*Preencha os campos acima antes de continuar</p> : ''}

        <div className={`form ${idsBlocked ? 'disableDiv' : ''}`} style={{ width: '100%' }}>
          <PlayerFields
            hasIds={hasIds}
            name={name}
            onNameChange={setName}
            onFieldBlur={() => setIdentityTouched(true)}
            nameError={nameError}
            onBirthDateChange={setBirthDate}
            genre={genre}
            onGenreChange={setGenre}
            infoError={infoError}
            categoryStatus={categoryStatus}
            category={category}
            showCategory={showCategory}
            divisionChoice={divisionChoice}
            onDivisionChange={setDivisionChoice}
          />

          {tournament.qrCodeUrl ? (
            <div id="qr-div">
              <div>
                <h2>Efetuar pagamento:</h2>
                <p>
                  Escaneie o QR Code com sua conta bancária ou use a chave Pix e confirme sua
                  inscrição
                </p>
                <div id="qr-key">
                  <p><strong>Ou copie o código:</strong></p>
                  <div className="input">
                    <p>{tournament.pixKey}</p>
                    <img src="/icons/copy.png" alt="copy" onClick={copyPixKey} />
                  </div>
                </div>
              </div>

              <img src={tournament.qrCodeUrl} alt="qrcode" />
            </div>
          ) : (
            ''
          )}

          <div className="upload-file" style={{ width: '100%' }}>
            <button
              onClick={() => receiptInput.current?.click()}
              type="button"
              className="button red"
            >
              <img
                src="/icons/upload.png"
                alt=""
                id="uploadIcon"
                fetchPriority="low"
                loading="lazy"
                decoding="async"
              />
              {' Anexar comprovante '}
              <span style={{ fontSize: '10pt' }}>(.jpg / .jpeg / .png)</span>
            </button>
            {receiptName !== '' ? <p>({receiptName})</p> : ''}
            <input
              ref={receiptInput}
              onChange={handleReceiptChange}
              type="file"
              id="input-comprovante"
              name="fileComprovante"
              accept=".jpg,.jpeg,.png"
              hidden
            />
          </div>

          <div id="final-button" className={canSubmit ? '' : 'disableDiv'}>
            <h1 style={{ marginBottom: '0px' }}>
              Valor total: {price === 0 ? '' : formatCurrency(price)}
            </h1>

            <button type="submit" className="button red big" style={{ textAlign: 'start' }}>
              Solicitar inscrição
            </button>

            {state.status === 'duplicate' ? (
              <p className="error pErr">Este ID FIDE já está inscrito</p>
            ) : (
              ''
            )}
            {state.status === 'error' ? <p className="error pErr">{state.message}</p> : ''}
          </div>
        </div>
      </form>
    </div>
  )
}
