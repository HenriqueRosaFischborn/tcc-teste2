'use server'

type Categorie = {
    name: string,
    value: string,
    from: number,
    to: number,
    divisionFor: string
}

type Res = {
    error: boolean,
    organized: Categorie[]
}

export default async function verifyCategorieDates(categories: Categorie[]): Promise<Res> {

    const newCat = categories[categories.length - 1]

    const otherCats = categories.slice(0, -1)

    const x = otherCats.some((el) => {
        if ((el.from <= newCat.to && newCat.to <= el.to) || (el.from <= newCat.from && newCat.from <= el.to)) {
            return true
        }
    })

    const y = otherCats.some((el) => {
        if ((newCat.from <= el.to && el.to <= newCat.to) || (newCat.from <= el.from && el.from <= newCat.to)) {
            return true
        }
    })

    if (x || y) {
        return {
            error: true,
            organized: categories
        }
    } else {
        for (let i = 0 ; i < otherCats.length ; i++) {
            if (otherCats[i + 1]) {
                if (otherCats[i].from < newCat.from && newCat.from < otherCats[i + 1].from) {
                    
                    otherCats.splice(i + 1, 0, newCat)
                    
                    return {
                        error: false,
                        organized: otherCats
                    }
                }
            } else {
                if (otherCats[0].from > newCat.from) {
                    return {
                        error: false,
                        organized: [newCat, ...otherCats]
                    } 
                } else {
                    return {
                        error: false,
                        organized: [...otherCats, newCat]
                    } 
                }
            }
        }

        return {
            error: false,
            organized: [...otherCats, newCat]
        }
        
    }

    console.log('Os pontos estão dentro de alguém? ', x)
    console.log('Tem alguém dentro dele? ', y)

}