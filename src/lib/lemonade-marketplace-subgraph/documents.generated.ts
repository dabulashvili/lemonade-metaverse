import gql from 'graphql-tag';

export const Offers = gql`
    subscription Offers {
  offers(orderBy: updatedAt, orderDirection: desc) {
    id
    createdAt
    updatedAt
    offerContract
    offerId
    tokenURI
    active
    seller
    currency
    price
    tokenContract
    tokenId
    buyer
  }
}
    `;